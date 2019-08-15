import angular from 'angular';
import _ from 'lodash';
import d3 from 'd3';
import { angular2react } from 'angular2react';
import { registerVisualization } from '@/visualizations';

import './gauge.less';
import Editor from './Editor';

const DEFAULT_OPTIONS = {
  okRange: 20,
  okColor: '#2ecc71',
  warningRange: 60,
  warningColor: '#f39c12',
  dangerRange: 80,
  dangerColor: '#e74c3c',
};

function createGauge(element, data, options) {
  const that = {};

  let config = {
    size: 200,
    clipWidth: 200,
    clipHeight: 110,
    ringInset: 20,
    ringWidth: 20,

    pointerWidth: 10,
    pointerTailLength: 5,
    pointerHeadLengthPercent: 0.9,

    minValue: 0,
    maxValue: 10,

    minAngle: -90,
    maxAngle: 90,

    transitionMs: 750,

    majorTicks: 3,
    labelFormat: d3.format(',g'),
    labelInset: 10,

    colors: [options.okColor, options.warningColor, options.dangerColor],
  };

  let range;
  let r;
  let pointerHeadLength;

  let svg;
  let arc;
  let scale;
  let ticks;
  let tickData;
  let pointer;


  function deg2rad(deg) {
    return deg * Math.PI / 180;
  }

  function configure(configuration) {
    config = {
      ...config,
      ...configuration,
    };

    range = config.maxAngle - config.minAngle;
    r = config.size / 2;
    pointerHeadLength = Math.round(r * config.pointerHeadLengthPercent);

    // a linear scale that maps domain values to a percent from 0..1
    scale = d3.scale.linear()
      .range([0, 1])
      .domain([config.minValue, config.maxValue]);

    ticks = scale.ticks(config.majorTicks);
    tickData = d3.range(config.majorTicks).map(() => 1 / config.majorTicks);

    arc = d3.svg.arc()
      .innerRadius(r - config.ringWidth - config.ringInset)
      .outerRadius(r - config.ringInset)
      .startAngle((d, i) => {
        const ratio = d * i;
        return deg2rad(config.minAngle + (ratio * range));
      })
      .endAngle((d, i) => {
        const ratio = d * (i + 1);
        return deg2rad(config.minAngle + (ratio * range));
      });
  }

  that.configure = configure;

  function centerTranslation() {
    return 'translate(' + r + ',' + r + ')';
  }

  function isRendered() {
    return (svg !== undefined);
  }

  that.isRendered = isRendered;

  function render(newValue) {
    svg = d3.select(element)
      .append('svg:svg')
      .attr('class', 'gauge')
      .attr('width', config.clipWidth)
      .attr('height', config.clipHeight);

    const centerTx = centerTranslation();

    const arcs = svg.append('g')
      .attr('class', 'arc')
      .attr('transform', centerTx);

    arcs.selectAll('path')
      .data(tickData)
      .enter().append('path')
      .attr('fill', (d, i) => config.colors[i])
      .attr('d', arc);

    const lg = svg.append('g')
      .attr('class', 'label')
      .attr('transform', centerTx);
    lg.selectAll('text')
      .data(ticks)
      .enter().append('text')
      .attr('transform', (d) => {
        const ratio = scale(d);
        const newAngle = config.minAngle + (ratio * range);
        return 'rotate(' + newAngle + ') translate(0,' + (config.labelInset - r) + ')';
      })
      .text(config.labelFormat);

    const lineData = [[config.pointerWidth / 2, 0],
      [0, -pointerHeadLength],
      [-(config.pointerWidth / 2), 0],
      [0, config.pointerTailLength],
      [config.pointerWidth / 2, 0]];
    const pointerLine = d3.svg.line().interpolate('monotone');
    const pg = svg.append('g').data([lineData])
      .attr('class', 'pointer')
      .attr('transform', centerTx);

    pointer = pg.append('path')
      .attr('d', pointerLine/* function(d) { return pointerLine(d) +'Z';} */)
      .attr('transform', 'rotate(' + config.minAngle + ')');

    update(newValue === undefined ? 0 : newValue);
  }

  that.render = render;

  function update(newValue, newConfiguration) {
    if (newConfiguration !== undefined) {
      configure(newConfiguration);
    }
    const ratio = scale(newValue);
    const newAngle = config.minAngle + (ratio * range);
    pointer.transition()
      .duration(config.transitionMs)
      .ease('elastic')
      .attr('transform', 'rotate(' + newAngle + ')');
  }

  that.update = update;

  configure({
    size: 300,
    clipWidth: 300,
    clipHeight: 300,
    ringWidth: 60,
    maxValue: options.dangerRange,
    transitionMs: 4000,
  });

  return that;
}

function isDataValid(data) {
  // data should contain column named 'value', otherwise no reason to render anything at all
  return _.find(data.columns, c => c.name === 'value');
}

const GaugeRenderer = {
  template: '<div class="power-gauge" resize-event="handleResize()"></div>',
  bindings: {
    data: '<',
    options: '<',
  },
  controller($scope, $element) {
    const container = $element[0].querySelector('.power-gauge');

    const update = () => {
      if (this.data && isDataValid(this.data)) {
        // do the render logic.
        angular.element(container).empty();

        createGauge(container, this.data.rows, this.options).render(this.data.rows[0].value);
      }
    };

    $scope.handleResize = _.debounce(update, 50);

    $scope.$watch('$ctrl.data', update);
    $scope.$watch('$ctrl.options', update, true);
  },
};

export default function init(ngModule) {
  ngModule.component('gaugeRenderer', GaugeRenderer);

  ngModule.run(($injector) => {
    registerVisualization({
      type: 'GAUGE',
      name: 'Gauge',
      getOptions: options => ({ ...DEFAULT_OPTIONS, ...options }),
      Renderer: angular2react('gaugeRenderer', GaugeRenderer, $injector),
      Editor,

      defaultRows: 7,
    });
  });
}

init.init = true;
