import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "widgets",
  title: "Book Buttons",
  icon: "\ud83d\udd17",
  group: "Distribution",
  order: 190,
  hidden: false,
  summary: "The embeddable Lightframe entry points, their placement, and how each one converts.",
  entities: ["widget", "item"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Book Buttons", sub: "The embeddable Lightframe entry points, their placement, and how each one converts." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
