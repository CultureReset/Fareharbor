import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "reports",
  title: "Reports",
  icon: "\ud83d\udcca",
  group: "Insights",
  order: 210,
  hidden: false,
  summary: "A report builder over every dataset, plus the saved and scheduled reports the team relies on.",
  entities: ["booking", "payment", "payout", "availability", "saved_report"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Reports", sub: "A report builder over every dataset, plus the saved and scheduled reports the team relies on." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
