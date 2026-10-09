/**
 * What Korda AI can change for someone, and how a proposal is checked.
 *
 * Korda AI calls these tools to *propose* a change; nothing here writes
 * anything. The server checks each call against what the person can see and
 * change, resolves the short codes (p1, t12) to real ids, and writes its own
 * description of what will happen (never the model's). The app shows that as
 * a card, and only when the person taps Bevestigen does the app carry it out,
 * with their own login, so the database's permissions apply exactly as when
 * they do it by hand.
 *
 * Not included on purpose: deleting a household or an account, unlinking a
 * bank. Korda AI points to where those are done.
 *
 * Nothing here is a route.
 */

const GROEP = ['nodig', 'wil', 'sparen', 'geen'];

export const TOOLS = [
  {
    name: 'maak_potje',
    description: 'Stel voor een nieuw potje aan te maken.',
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Een eigen code voor dit nieuwe potje, zoals nieuw1. Gebruik die code bij deel_in om in hetzelfde voorstel betalingen in dit nieuwe potje te zetten.',
        },
        naam: { type: 'string', description: 'Naam van het potje, kort (max 40 tekens).' },
        emoji: { type: 'string', description: 'Eén passende emoji.' },
        limiet: { type: 'number', description: 'Limiet per maand in euro.' },
        soort: { type: 'string', enum: ['flexibel', 'vast'], description: 'vast voor huur, abonnementen en andere vaste bedragen.' },
        groep: { type: 'string', enum: GROEP, description: 'nodig, wil of sparen (50/30/20), of geen.' },
        voor: { type: 'string', enum: ['gedeeld', 'persoonlijk'], description: 'gedeeld voor het hele huishouden, persoonlijk voor alleen deze persoon.' },
      },
      required: ['code', 'naam', 'emoji', 'limiet', 'soort', 'groep', 'voor'],
      additionalProperties: false,
    },
  },
  {
    name: 'wijzig_potje',
    description: 'Stel voor een bestaand potje te wijzigen. Geef alleen de velden mee die veranderen.',
    input_schema: {
      type: 'object',
      properties: {
        potje: { type: 'string', description: 'Code van het potje, zoals p3.' },
        naam: { type: 'string' },
        emoji: { type: 'string' },
        limiet: { type: 'number', description: 'Nieuwe limiet per maand in euro.' },
        soort: { type: 'string', enum: ['flexibel', 'vast'] },
        groep: { type: 'string', enum: GROEP },
      },
      required: ['potje'],
      additionalProperties: false,
    },
  },
  {
    name: 'archiveer_potje',
    description: 'Stel voor een potje te archiveren. Het verdwijnt uit het overzicht; de geschiedenis blijft bewaard.',
    input_schema: {
      type: 'object',
      properties: { potje: { type: 'string', description: 'Code van het potje, zoals p3.' } },
      required: ['potje'],
      additionalProperties: false,
    },
  },
  {
    name: 'deel_in',
    description:
      'Stel voor betalingen in te delen: in een potje, of als inkomen of overboeking. Met onthoud worden ze voortaan ook automatisch zo ingedeeld voor dezelfde tegenpartij.',
    input_schema: {
      type: 'object',
      properties: {
        transacties: { type: 'array', items: { type: 'string' }, description: 'Codes van de betalingen, zoals t4 en t12.' },
        potje: {
          type: 'string',
          description: 'Code van het potje (p1, ...), of de code van een potje dat je in dit voorstel aanmaakt (nieuw1). Laat weg bij inkomen of overboeking.',
        },
        soort: { type: 'string', enum: ['inkomen', 'overboeking'], description: 'Alleen als het geen uitgave in een potje is.' },
        onthoud: { type: 'boolean', description: 'Voortaan automatisch voor dezelfde tegenpartij.' },
      },
      required: ['transacties', 'onthoud'],
      additionalProperties: false,
    },
  },
  {
    name: 'splits',
    description: 'Stel voor één betaling te verdelen over meerdere potjes. De delen moeten samen precies het bedrag van de betaling zijn.',
    input_schema: {
      type: 'object',
      properties: {
        transactie: { type: 'string', description: 'Code van de betaling, zoals t7.' },
        delen: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              potje: { type: 'string', description: 'Code van het potje (p1, ...) of van een nieuw potje uit dit voorstel (nieuw1).' },
              bedrag: { type: 'number', description: 'Deel in euro, positief.' },
            },
            required: ['potje', 'bedrag'],
            additionalProperties: false,
          },
        },
      },
      required: ['transactie', 'delen'],
      additionalProperties: false,
    },
  },
  {
    name: 'maak_doel',
    description: 'Stel voor een nieuw spaardoel aan te maken.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Een eigen code voor dit nieuwe doel, zoals nieuwdoel1, om er in hetzelfde voorstel geld in te storten.' },
        naam: { type: 'string', description: 'Naam van het doel (max 60 tekens).' },
        emoji: { type: 'string' },
        doelbedrag: { type: 'number', description: 'Het bedrag dat ze willen sparen, in euro.' },
        deadline: { type: 'string', description: 'Uiterlijk op deze datum (JJJJ-MM-DD), of een lege string.' },
        voor: { type: 'string', enum: ['gedeeld', 'persoonlijk'] },
      },
      required: ['code', 'naam', 'emoji', 'doelbedrag', 'deadline', 'voor'],
      additionalProperties: false,
    },
  },
  {
    name: 'stort_in_doel',
    description: 'Stel voor geld in een spaardoel te storten, of eruit te halen.',
    input_schema: {
      type: 'object',
      properties: {
        doel: { type: 'string', description: 'Code van het doel (g1, ...) of van een nieuw doel uit dit voorstel.' },
        bedrag: { type: 'number', description: 'Bedrag in euro, positief.' },
        richting: { type: 'string', enum: ['storten', 'opnemen'] },
      },
      required: ['doel', 'bedrag', 'richting'],
      additionalProperties: false,
    },
  },
  {
    name: 'notitie',
    description: 'Stel voor een notitie bij een betaling te zetten.',
    input_schema: {
      type: 'object',
      properties: {
        transactie: { type: 'string', description: 'Code van de betaling, zoals t7.' },
        tekst: { type: 'string', description: 'De notitie, kort.' },
      },
      required: ['transactie', 'tekst'],
      additionalProperties: false,
    },
  },
  {
    name: 'maak_uitnodiging',
    description: 'Stel voor een uitnodigingscode te maken waarmee iemand lid wordt van dit huishouden.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'wijzig_mijn_naam',
    description: 'Stel voor de naam te wijzigen waarmee deze persoon in het huishouden staat.',
    input_schema: {
      type: 'object',
      properties: { naam: { type: 'string', description: 'De nieuwe naam (max 40 tekens).' } },
      required: ['naam'],
      additionalProperties: false,
    },
  },
];

const euro = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
const norm = (s) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const limiet = (v) => {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? n : null;
};
/** One emoji (the first grapheme), or a box when there's none. */
function eenEmoji(v) {
  const t = String(v ?? '').trim();
  const eerste = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter('nl', { granularity: 'grapheme' }).segment(t)][0]?.segment : [...t][0];
  return eerste && /\p{Extended_Pictographic}/u.test(eerste) ? eerste : '📦';
}
const tekst = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const potLabel = (p) => `${p.emoji} ${p.name}`;

/**
 * Turn Korda AI's tool calls into a checked proposal.
 * ctx: { alias (p-code → pot id), potten, txAlias (t-code → payment), splitIds, userId }
 * Returns { acties: [...], notities: [...] } — notities say what was left out and why.
 */
export function maakVoorstel(toolCalls, ctx) {
  const potVan = (code) => {
    const id = ctx.alias.get(String(code ?? '').trim());
    return ctx.potten.find((p) => p.id === id) ?? null;
  };
  const magWijzigen = (p) => p.scope === 'shared' || p.owner_id === ctx.userId;
  // Pots and goals this proposal creates, by the code Korda AI gave them, so a later step can use them.
  const nieuw = new Map();
  const nieuweDoelen = new Map();
  const doelVan = (code) => {
    const id = ctx.doelAlias?.get(String(code ?? '').trim());
    return ctx.doelen?.find((d) => d.id === id) ?? null;
  };
  const acties = [];
  const notities = [];

  for (const call of toolCalls) {
    const i = call.input ?? {};
    switch (call.name) {
      case 'maak_potje': {
        const naam = tekst(i.naam, 40);
        const bedrag = limiet(i.limiet);
        if (!naam || bedrag === null) {
          notities.push('Een nieuw potje had geen geldige naam of limiet.');
          break;
        }
        const emoji = eenEmoji(i.emoji);
        const gedeeld = i.voor !== 'persoonlijk';
        const groep = ['nodig', 'wil', 'sparen'].includes(i.groep) ? i.groep : null;
        const code = tekst(i.code, 20) || `nieuw${nieuw.size + 1}`;
        nieuw.set(code, { name: naam, emoji });
        acties.push({
          type: 'maak_potje',
          code,
          naam,
          emoji,
          limiet: bedrag,
          soort: i.soort === 'vast' ? 'vast' : 'flexibel',
          groep,
          gedeeld,
          omschrijving: `Nieuw potje ${emoji} ${naam}: ${euro(bedrag)} per maand, ${gedeeld ? 'gedeeld' : 'alleen voor jou'}${i.soort === 'vast' ? ', vaste lasten' : ''}${groep ? `, ${groep}` : ''}`,
        });
        break;
      }
      case 'wijzig_potje': {
        const p = potVan(i.potje);
        if (!p) {
          notities.push(`Potje ${i.potje ?? '?'} ken ik niet.`);
          break;
        }
        if (!magWijzigen(p)) {
          notities.push(`${potLabel(p)} is van iemand anders; dat kan alleen die persoon wijzigen.`);
          break;
        }
        const velden = {};
        const delen = [];
        if (i.naam != null && tekst(i.naam, 40) && tekst(i.naam, 40) !== p.name) {
          velden.name = tekst(i.naam, 40);
          delen.push(`naam wordt "${velden.name}"`);
        }
        if (i.emoji != null && eenEmoji(i.emoji) !== p.emoji) {
          velden.emoji = eenEmoji(i.emoji);
          delen.push(`icoon wordt ${velden.emoji}`);
        }
        if (i.limiet != null && limiet(i.limiet) !== null && limiet(i.limiet) !== Number(p.monthly_limit)) {
          velden.monthly_limit = limiet(i.limiet);
          delen.push(`limiet van ${euro(Number(p.monthly_limit))} naar ${euro(velden.monthly_limit)}`);
        }
        if (i.soort === 'vast' || i.soort === 'flexibel') {
          if (i.soort !== p.kind) {
            velden.kind = i.soort;
            delen.push(i.soort === 'vast' ? 'wordt vaste lasten' : 'wordt flexibel');
          }
        }
        if (GROEP.includes(i.groep)) {
          const g = i.groep === 'geen' ? null : i.groep;
          if (g !== (p.groep ?? null)) {
            velden.groep = g;
            delen.push(g ? `groep ${g}` : 'geen groep');
          }
        }
        if (!delen.length) {
          notities.push(`Aan ${potLabel(p)} verandert niets.`);
          break;
        }
        acties.push({ type: 'wijzig_potje', potId: p.id, velden, omschrijving: `${potLabel(p)}: ${delen.join(', ')}` });
        break;
      }
      case 'archiveer_potje': {
        const p = potVan(i.potje);
        if (!p || !magWijzigen(p)) {
          notities.push(p ? `${potLabel(p)} is van iemand anders.` : `Potje ${i.potje ?? '?'} ken ik niet.`);
          break;
        }
        acties.push({ type: 'archiveer_potje', potId: p.id, omschrijving: `${potLabel(p)} archiveren (de geschiedenis blijft bewaard)` });
        break;
      }
      case 'deel_in': {
        const codes = Array.isArray(i.transacties) ? i.transacties.slice(0, 300) : [];
        const gevonden = codes.map((c) => ctx.txAlias.get(String(c).trim())).filter(Boolean);
        const uniek = [...new Map(gevonden.map((t) => [t.id, t])).values()];
        // A split payment keeps its split; re-sorting it is done by hand.
        const gesplitst = uniek.filter((t) => ctx.splitIds.has(t.id));
        let betalingen = uniek.filter((t) => !ctx.splitIds.has(t.id));
        if (gesplitst.length) notities.push(`${gesplitst.length} verdeelde betaling(en) laat ik zoals ze zijn.`);
        if (codes.length > uniek.length) notities.push(`${codes.length - uniek.length} betaling(en) kon ik niet vinden.`);

        const nieuwCode = i.potje && nieuw.has(String(i.potje).trim()) ? String(i.potje).trim() : null;
        const p = nieuwCode ? nieuw.get(nieuwCode) : i.potje ? potVan(i.potje) : null;
        const soort = !p && (i.soort === 'inkomen' || i.soort === 'overboeking') ? i.soort : null;
        if (!p && !soort) {
          notities.push(i.potje ? `Potje ${i.potje} ken ik niet.` : 'Er stond niet bij waar de betalingen heen moeten.');
          break;
        }
        if (soort === 'inkomen') {
          const af = betalingen.filter((t) => t.amount <= 0);
          if (af.length) notities.push(`${af.length} afschrijving(en) kunnen geen inkomen zijn; die laat ik staan.`);
          betalingen = betalingen.filter((t) => t.amount > 0);
        }
        if (!betalingen.length) break;

        const namen = new Map();
        for (const t of betalingen) {
          const n = t.counterparty ?? t.description ?? 'onbekend';
          namen.set(n, (namen.get(n) ?? 0) + 1);
        }
        const wie = [...namen.entries()]
          .slice(0, 3)
          .map(([n, aantal]) => (aantal > 1 ? `${n} ×${aantal}` : n))
          .join(', ');
        const regels = i.onthoud
          ? [...new Map(betalingen.filter((t) => t.counterparty).map((t) => [norm(t.counterparty), t.counterparty])).values()]
          : [];
        const doel = p ? `naar ${potLabel(p)}` : soort === 'inkomen' ? 'als inkomen' : 'als overboeking';
        acties.push({
          type: 'deel_in',
          txIds: betalingen.map((t) => t.id),
          potId: nieuwCode ? null : (p?.id ?? null),
          // A pot made earlier in this same proposal: the app fills in its id.
          nieuwPot: nieuwCode,
          soort,
          regels,
          omschrijving: `${betalingen.length} ${betalingen.length === 1 ? 'betaling' : 'betalingen'} ${doel} (${wie}${namen.size > 3 ? ', …' : ''})${
            regels.length ? `, en voortaan automatisch voor ${regels.slice(0, 2).join(', ')}${regels.length > 2 ? ', …' : ''}` : ''
          }`,
        });
        break;
      }
      case 'splits': {
        const t = ctx.txAlias.get(String(i.transactie ?? '').trim());
        if (!t) {
          notities.push(`Betaling ${i.transactie ?? '?'} ken ik niet.`);
          break;
        }
        if (!ctx.splitsbaar?.has(t.id)) {
          notities.push(`${t.counterparty ?? 'Die betaling'} komt van een rekening die je niet helemaal ziet; verdelen kan alleen wie hem betaalde.`);
          break;
        }
        const delen = [];
        let fout = null;
        for (const d of Array.isArray(i.delen) ? i.delen.slice(0, 8) : []) {
          const code = String(d.potje ?? '').trim();
          const bedrag = limiet(d.bedrag);
          const pNieuw = nieuw.has(code) ? nieuw.get(code) : null;
          const pBestaand = pNieuw ? null : potVan(code);
          if (!(pNieuw || pBestaand) || !bedrag) {
            fout = `Een deel had geen geldig potje of bedrag.`;
            break;
          }
          delen.push({ potId: pBestaand?.id ?? null, nieuwPot: pNieuw ? code : null, bedrag, label: potLabel(pNieuw ?? pBestaand) });
        }
        const totaal = Math.round(delen.reduce((s, d) => s + d.bedrag, 0) * 100);
        if (!fout && delen.length < 2) fout = 'Verdelen kan pas met minstens twee delen.';
        if (!fout && totaal !== Math.round(Math.abs(t.amount) * 100)) {
          fout = `De delen (${euro(totaal / 100)}) zijn niet samen ${euro(Math.abs(t.amount))}.`;
        }
        if (fout) {
          notities.push(fout);
          break;
        }
        acties.push({
          type: 'splits',
          txId: t.id,
          teken: t.amount < 0 ? -1 : 1,
          delen: delen.map(({ label, ...d }) => d),
          omschrijving: `${t.counterparty ?? 'Betaling'} (${euro(Math.abs(t.amount))}) verdelen: ${delen.map((d) => `${euro(d.bedrag)} ${d.label}`).join(', ')}`,
        });
        break;
      }
      case 'maak_doel': {
        const naam = tekst(i.naam, 60);
        const doelbedrag = limiet(i.doelbedrag);
        if (!naam || !doelbedrag) {
          notities.push('Een nieuw doel had geen geldige naam of bedrag.');
          break;
        }
        const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(i.deadline ?? '')) ? i.deadline : null;
        const emoji = eenEmoji(i.emoji);
        const gedeeld = i.voor !== 'persoonlijk';
        const code = tekst(i.code, 20) || `nieuwdoel${nieuweDoelen.size + 1}`;
        nieuweDoelen.set(code, { name: naam, emoji });
        acties.push({
          type: 'maak_doel',
          code,
          naam,
          emoji,
          doelbedrag,
          deadline,
          gedeeld,
          omschrijving: `Nieuw spaardoel ${emoji} ${naam}: ${euro(doelbedrag)}${deadline ? `, uiterlijk ${deadline}` : ''}, ${gedeeld ? 'gedeeld' : 'alleen voor jou'}`,
        });
        break;
      }
      case 'stort_in_doel': {
        const code = String(i.doel ?? '').trim();
        const dNieuw = nieuweDoelen.get(code) ?? null;
        const dBestaand = dNieuw ? null : doelVan(code);
        const bedrag = limiet(i.bedrag);
        if (!(dNieuw || dBestaand) || !bedrag) {
          notities.push(`Doel ${code || '?'} ken ik niet, of het bedrag klopt niet.`);
          break;
        }
        const opnemen = i.richting === 'opnemen';
        if (opnemen && dBestaand && bedrag > (ctx.gespaard?.get(dBestaand.id) ?? 0) + 0.005) {
          notities.push(`Uit ${dBestaand.emoji} ${dBestaand.name} kan niet meer dan ${euro(ctx.gespaard?.get(dBestaand.id) ?? 0)} worden opgenomen.`);
          break;
        }
        const d = dNieuw ?? dBestaand;
        acties.push({
          type: 'stort_in_doel',
          doelId: dBestaand?.id ?? null,
          nieuwDoel: dNieuw ? code : null,
          bedrag: opnemen ? -bedrag : bedrag,
          omschrijving: `${euro(bedrag)} ${opnemen ? 'opnemen uit' : 'storten in'} ${d.emoji} ${d.name}`,
        });
        break;
      }
      case 'notitie': {
        const t = ctx.txAlias.get(String(i.transactie ?? '').trim());
        const n = tekst(i.tekst, 200);
        if (!t || !n) {
          notities.push('Een notitie had geen betaling of tekst.');
          break;
        }
        acties.push({ type: 'notitie', txId: t.id, tekst: n, omschrijving: `Notitie bij ${t.counterparty ?? 'betaling'} (${t.booked_on}): "${n}"` });
        break;
      }
      case 'maak_uitnodiging':
        acties.push({ type: 'maak_uitnodiging', omschrijving: 'Nieuwe uitnodigingscode maken (een week geldig, één keer te gebruiken)' });
        break;
      case 'wijzig_mijn_naam': {
        const naam = tekst(i.naam, 40);
        if (!naam) break;
        acties.push({ type: 'wijzig_mijn_naam', naam, omschrijving: `Je naam in het huishouden wordt "${naam}"` });
        break;
      }
      default:
        notities.push(`Onbekende actie ${call.name}.`);
    }
  }
  return { acties, notities };
}
