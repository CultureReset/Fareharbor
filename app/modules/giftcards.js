import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "giftcards",
  title: "Gift Cards",
  icon: "\ud83c\udf81",
  group: "Guests",
  order: 140,
  hidden: false,
  summary: "Issued cards, remaining balances, redemption history and the outstanding liability they represent.",
  entities: ["gift_card"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Gift Cards", sub: "Issued cards, remaining balances, redemption history and the outstanding liability they represent." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
