import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "payments",
  title: "Payments",
  icon: "\ud83d\udcb3",
  group: "Money",
  order: 160,
  hidden: false,
  summary: "Every charge, refund, void and chargeback, with the processing fees attached.",
  entities: ["payment", "booking"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Payments", sub: "Every charge, refund, void and chargeback, with the processing fees attached." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
