import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "guide",
  title: "Platform Map",
  icon: "\ud83d\uddfa",
  group: "Reference",
  order: 270,
  hidden: false,
  summary: "The written map: what FareHarbor is, how the pieces fit, and the flows that connect them.",
  entities: [],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Platform Map", sub: "The written map: what FareHarbor is, how the pieces fit, and the flows that connect them." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
