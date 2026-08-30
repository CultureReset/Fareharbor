import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "customfields",
  title: "Custom Fields",
  icon: "\u2753",
  group: "Catalog",
  order: 100,
  hidden: false,
  summary: "Operator-defined questions asked at booking or per guest, and where their answers surface.",
  entities: ["custom_field", "custom_field_value"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Custom Fields", sub: "Operator-defined questions asked at booking or per guest, and where their answers surface." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
