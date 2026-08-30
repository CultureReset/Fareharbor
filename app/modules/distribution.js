import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "distribution",
  title: "Affiliates & Channels",
  icon: "\ud83e\udd1d",
  group: "Distribution",
  order: 180,
  hidden: false,
  summary: "Resellers, concierges and OTAs, their commission terms, and what each channel actually produces.",
  entities: ["affiliate", "channel", "booking"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Affiliates & Channels", sub: "Resellers, concierges and OTAs, their commission terms, and what each channel actually produces." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
