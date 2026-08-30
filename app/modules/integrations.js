import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "integrations",
  title: "Integrations & API",
  icon: "\ud83d\udd0c",
  group: "Admin",
  order: 240,
  hidden: false,
  summary: "API keys, webhooks, the external API surface, and the third-party connections.",
  entities: ["api_key", "webhook"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Integrations & API", sub: "API keys, webhooks, the external API surface, and the third-party connections." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
