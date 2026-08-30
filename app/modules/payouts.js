import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "payouts",
  title: "Payouts",
  icon: "\ud83c\udfe6",
  group: "Money",
  order: 170,
  hidden: false,
  summary: "Settlement batches to the bank account, and the reconciliation from gross sales to net paid.",
  entities: ["payout", "payment"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Payouts", sub: "Settlement batches to the bank account, and the reconciliation from gross sales to net paid." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
