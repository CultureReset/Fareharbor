import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "marketplaces",
  title: "Marketplaces",
  icon: "\ud83c\udf10",
  group: "Distribution",
  order: 200,
  hidden: false,
  summary: "Syndicated listings to Google Things to Do and OTAs, with sync state and errors.",
  entities: ["external_listing", "item"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Marketplaces", sub: "Syndicated listings to Google Things to Do and OTAs, with sync state and errors." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
