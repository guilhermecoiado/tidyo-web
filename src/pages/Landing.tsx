// Generated from the canvas artboard Landing.dc.html (scripts/dc2jsx.py). Edit the canvas, then regenerate.
/* eslint-disable */
// @ts-nocheck
import { Fragment, useEffect, useReducer, useRef } from 'react';
import './landing.css';

class DCLogic {
  props: any; state: any = {}; _update: () => void = () => {};
  constructor(props: any) { this.props = props; }
  setState(patch: any) { this.state = { ...this.state, ...patch }; this._update(); }
}


class LandingLogic extends DCLogic {
  constructor(props){
    super(props);
    this.state = { mode: 'res', yearly: false, open: 0, scene: 0, tick: 0, playing: true, persona: 0, tier: 0, chat: false, popup: false, popupSeen: false };
  }
  componentDidMount(){
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) this.setState({ playing: false });
    this._iv = setInterval(() => {
      const s = this.state;
      if (!s.playing) return;
      if (s.tick >= 24) this.setState({ tick: 0, scene: (s.scene + 1) % 4 });
      else this.setState({ tick: s.tick + 1 });
    }, 200);
    this._pt = setTimeout(() => { if (!this.state.popupSeen) this.setState({ popup: true, popupSeen: true }); }, 15000);
  }
  componentWillUnmount(){ clearInterval(this._iv); clearTimeout(this._pt); }
  renderVals() {
    const S = this.state;
    const P = this.props || {};
    const I = {
      dollar: 'M3 6h18v12H3zM3 10h18M7 15h3',
      route: 'M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5M6 21.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM18 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
      clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
      sad: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 16c1-1.3 2.2-2 3.5-2s2.5.7 3.5 2M9 10h.01M15 10h.01',
      cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
      lang: 'M4 5h8M8 3v2M5 9c1.5 3 4 5 7 6M11 5c-1 4-3 7-7 9M13 21l4-9 4 9M14.5 18h5',
      cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
      doc: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12h8M8 16h5',
      chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
      off: 'M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18',
      shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
      chat: 'M4 5h16v11H9l-5 4z',
      team: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
      bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
      sparkle: 'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z',
      phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
      card: 'M3 6h18v12H3zM3 10h18',
      unlock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.5-2',
      download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
      x: 'M18 6L6 18M6 6l12 12',
      upload: 'M12 21V9M7 14l5-5 5 5M4 3h16'
    };

    const heroTrust = ['14 dias grátis, sem cartão', 'Importamos seus clientes', 'Suporte humano em PT · EN · ES'];

    // demo video
    const C = [
      { title: 'O Tidy revisa o dia', sub: '5:00 · antes de você acordar', who: 'Cena 1 · a dona', capT: 'Você acorda com o dia já revisado.', capX: 'O Tidy encontrou um conflito de horário, faturas vencidas e uma helper perto do limite de horas. Um toque resolve, e todo mundo é avisado no próprio idioma.' },
      { title: 'Rota otimizada', sub: '−48 min no carro', who: 'Cena 2 · a rota', capT: 'Menos volante, mais casas limpas.', capX: 'A ordem das casas é calculada a partir do ponto de partida de cada helper. Você pode ajustar na mão e abrir direto no Waze, Google Maps ou Apple Maps.' },
      { title: 'Checklist com fotos', sub: 'Mesmo sem sinal', who: 'Cena 3 · a helper', capT: 'A helper só abre e trabalha, em espanhol.', capX: 'Tarefas por cômodo, fotos de antes e depois e horas contadas sozinhas. Sem internet? Tudo fica salvo e sincroniza quando o sinal volta.' },
      { title: 'Fatura paga', sub: 'Zelle, Venmo ou cheque', who: 'Cena 4 · o cliente', capT: 'O cliente paga e avalia, em inglês.', capX: 'Ao fim do job, você cobra em um toque e o cliente recebe a fatura em PDF no idioma dele. Quando ele paga, você dá baixa e o financeiro já está atualizado.' }
    ];
    const prog = S.tick / 24 * 100;
    const chapters = C.map((c, i) => {
      const on = S.scene === i;
      return {
        n: i + 1, title: c.title, sub: c.sub, sel: on ? 'true' : 'false',
        bg: on ? '#0F4A41' : 'transparent', border: on ? '#2A6A60' : '#1E5149',
        numBg: on ? '#5FD4C1' : '#14463F', numFg: on ? '#0A3D35' : '#9DB5B0',
        prog: i < S.scene ? 100 : on ? Math.round(prog) : 0,
        go: () => this.setState({ scene: i, tick: 0 })
      };
    });
    const cur = C[S.scene];
    const demoTasks = [
      { t: 'Limpiar estufa y horno', d: 'd1' },
      { t: 'Encimeras y fregadero', d: 'd2' },
      { t: 'Frente de electrodomésticos', d: 'd3' },
      { t: 'Barrer y trapear el piso', d: 'd4' },
      { t: 'Vaciar la basura', d: 'd6' }
    ];

    const pains = [
      { icon: I.dollar, title: 'Cobranças atrasadas', stat: '~US$40 mil', text: 'é quanto pequenas empresas americanas dizem perder por ano, em média, com pagamentos atrasados.' },
      { icon: I.route, title: 'Rotas ruins', stat: '15–30%', text: 'do dia da equipe de campo vai no volante, e não no serviço que gera receita.' },
      { icon: I.clock, title: 'Agendamentos esquecidos', stat: '−29%', text: 'de faltas em média com lembretes automáticos, num estudo em saúde. Sem lembrete, o horário fica vazio.' },
      { icon: I.sad, title: 'Clientes insatisfeitos', stat: 'Sem prova', text: 'Sem foto, horário e checklist, uma reclamação vira palavra contra palavra, e o cliente vai embora.' }
    ];

    const personas = [
      { label: 'Trabalho sozinha', title: 'Para quem limpa e administra ao mesmo tempo', text: 'No modo solo, a sua tela junta o painel da dona e o “Meu dia” da helper. Nada de cadastrar equipe para começar.',
        rows: [
          ['Agenda no papel ou no WhatsApp, e um esquecimento custa a casa.', 'Agenda recorrente com lembrete automático para o cliente confirmar ou remarcar.'],
          ['Vergonha de cobrar, e cliente que “esquece” de pagar.', 'Fatura sai sozinha ao fim do job, e o lembrete de vencido é enviado pelo app, não por você.'],
          ['Cancelamento em cima da hora sem nenhuma compensação.', 'Política de cancelamento aceita no cadastro e taxa cobrada automaticamente.'],
          ['No fim do ano, não sabe quanto gastou com gasolina e produto.', 'Despesas com foto do recibo e quilometragem, prontas para o contador.'],
          ['Cliente em inglês e você ainda inseguro no idioma.', 'Você escreve em português, o cliente recebe em inglês. Sempre.']
        ] },
      { label: 'Tenho equipe', title: 'Para quem tem helpers e quer crescer sem perder o controle', text: 'Escala, horas, qualidade e dinheiro no mesmo painel, com o Tidy apontando o que precisa de você.',
        rows: [
          ['Helper falta e você descobre quando o cliente liga.', 'Check-in com localização e aviso na hora; o Tidy sugere quem pode cobrir.'],
          ['Calcular horas e pagamento da equipe em planilha.', 'Horas contadas no app, gorjetas e reembolsos somados, relatório pronto para pagar e para o 1099.'],
          ['Reclamação vira palavra contra palavra.', 'Checklist por cômodo com fotos de antes e depois, horário e local.'],
          ['Não sabe quais clientes dão lucro de verdade.', 'Lucro por cliente e por serviço, descontando equipe e insumos.'],
          ['Equipe fala espanhol, clientes falam inglês, você fala português.', 'Cada pessoa usa o app e recebe mensagens no próprio idioma.']
        ] },
      { label: 'Sou helper', title: 'Para quem está em campo o dia todo', text: 'Um app simples, no idioma dela, que só mostra o dia de hoje. Ela entra por um link no WhatsApp, sem senha complicada.',
        rows: [
          ['Endereço, código do portão e instruções espalhados em mensagens.', 'Cada parada já tem endereço, acesso, pets e pedidos do cliente.'],
          ['Instruções em inglês que ela não entende bem.', 'Tudo chega em espanhol ou português, inclusive o que o cliente escreveu.'],
          ['Horas trabalhadas que ninguém confere direito.', 'Horas contadas a cada check-in e check-out, visíveis para ela também.'],
          ['Gasta do próprio bolso com gasolina e produto e esquece de pedir de volta.', '“Registrar gasto” com foto do recibo vai direto para aprovação.'],
          ['Sem sinal dentro da casa, o app trava.', 'Checklist e fotos funcionam offline e sincronizam depois.']
        ] }
    ];
    const pOn = { bg: '#FFFFFF', fg: '#0A3D35' }, pOff = { bg: 'transparent', fg: '#4E7770' };
    const personaTabs = personas.map((p, i) => ({ label: p.label, sel: S.persona === i ? 'true' : 'false', bg: S.persona === i ? pOn.bg : pOff.bg, fg: S.persona === i ? pOn.fg : pOff.fg, go: () => this.setState({ persona: i }) }));
    const pc = personas[S.persona];
    const persona = { title: pc.title, text: pc.text, rows: pc.rows.map(([pain, fix]) => ({ pain, fix })) };

    const ownerSide = ['Agenda de todas as helpers e conflitos detectados na hora', 'Faturas, recebimentos e lucro por cliente', 'Horas, gorjetas e reembolsos da equipe', 'Revisão diária do Tidy com o botão para resolver', 'Permissões: cada pessoa vê só o que precisa', 'Contratos comerciais, inspeções e renovações'];
    const helperSide = ['Só o dia dela, na ordem certa da rota', 'Instruções da casa no idioma dela', 'Checklist por cômodo, com fotos', 'Horas de hoje e da semana', 'Registrar gasto com foto do recibo', 'Funciona sem sinal e entra por link no WhatsApp'];

    const feats = [
      [I.cal, 'Agenda que não se perde', 'Recorrência, conflitos detectados na hora e lembrete automático para o cliente confirmar ou reagendar.'],
      [I.route, 'Rotas otimizadas pelo Tidy', 'Menos tempo no carro: a ordem das casas é calculada a partir do ponto de partida de cada helper.'],
      [I.dollar, 'Recebe de qualquer jeito', 'Zelle, Venmo, cheque ou dinheiro registrados em um toque. Cartão e ACH pela Stripe chegam em breve.'],
      [I.cam, 'Prova do serviço', 'Checklist com fotos de antes e depois, horário e local. O cliente avalia em até 24 horas.'],
      [I.team, 'Horas e pagamento da equipe', 'Check-in e check-out, gorjetas, reembolsos e relatório pronto para pagar e para o 1099.'],
      [I.lang, 'Português, inglês e espanhol', 'Cada pessoa usa o app e recebe mensagens no próprio idioma, com tradução automática.'],
      [I.chart, 'Financeiro que orienta', 'Entradas, saídas, lucro por cliente e exportação para o QuickBooks e para o seu contador.'],
      [I.off, 'Funciona sem sinal', 'A helper faz checklist e fotos mesmo sem internet; tudo sincroniza depois.'],
      [I.doc, 'Contratos comerciais', 'Walkthrough no celular, proposta calculada, contrato com reajuste e aviso de renovação.']
    ];
    const tones = [['#D4F1E9', '#0A3D35'], ['#0A3D35', '#5FD4C1'], ['#E3F5EF', '#0B7C6E']];
    const features = feats.map(([icon, title, text], i) => ({ icon, title, text, bg: tones[i % 3][0], fg: tones[i % 3][1] }));

    const insights = [
      { tag: 'Conflito', bg: '#5A2416', fg: '#FFB59C', title: 'Bianca está em 2 casas às 10:00', detail: 'Tidy sugere passar a família Miller para a Joana.' },
      { tag: 'Rota', bg: '#173F3A', fg: '#5FD4C1', title: '48 minutos a menos amanhã', detail: 'Nova ordem das casas para Bianca e Joana.' },
      { tag: 'Contrato', bg: '#4A3510', fg: '#F5C66B', title: 'Dental Care vence em 12 dias', detail: 'Sem reajuste há 14 meses; a margem caiu para 19%.' },
      { tag: 'Cobrança', bg: '#4A1A1A', fg: '#FF9C9C', title: '3 faturas vencidas · $1,240', detail: 'Lembretes prontos para enviar.' }
    ];

    const compare = [
      { icon: I.bolt, topic: 'Estabilidade', them: 'Bugs, telas que travam e o app que cai justo no meio do dia.', us: 'Feito para funcionar até sem internet. Status público do sistema e correções sem esperar meses.' },
      { icon: I.card, topic: 'Pagamentos', them: 'Só aceita um jeito de pagar; o resto fica fora do sistema.', us: 'Fatura em PDF com seus dados de Zelle, Venmo e cheque, e baixa em um toque. Cartão e ACH em breve.' },
      { icon: I.team, topic: 'Equipe e contas', them: 'Folha de pagamento e contabilidade “em breve”, e você de volta à planilha.', us: 'Horas, gorjetas e reembolsos somados; exportação para QuickBooks e relatório para o 1099.' },
      { icon: I.sparkle, topic: 'Design', them: 'Telas antigas e confusas que a equipe não quer abrir.', us: 'Moderno, feito para o celular, com uma ação principal por tela. Sem treinamento.' },
      { icon: I.phone, topic: 'Suporte', them: 'Só e-mail em inglês, e resposta dias depois.', us: 'Pessoas de verdade por chat, WhatsApp e chamada agendada, em português, inglês e espanhol.' },
      { icon: I.lang, topic: 'Idiomas', them: 'Tudo em inglês, inclusive para a sua equipe.', us: 'Português, inglês e espanhol de verdade, com tradução automática entre as pessoas.' }
    ];
    const switchSteps = [
      { n: 1, title: 'Teste com dados de exemplo', text: '14 dias com tudo liberado e uma empresa de exemplo pronta, para você ver o app funcionando antes de mexer nos seus dados.' },
      { n: 2, title: 'Chamada de configuração', text: '30 minutos por vídeo ou telefone, no seu idioma, para deixar tudo do jeito da sua empresa.' },
      { n: 3, title: 'Importação dos seus dados', text: 'Mande a planilha ou a exportação do app atual. A gente importa clientes, endereços, preços e recorrências.' }
    ];

    const M = {
      res: { title: 'Para quem cuida de casas', text: 'Sozinha ou com helpers: agenda recorrente, rotas, pagamento da equipe e um site de agendamento grátis para seus clientes.', items: ['Agenda semanal e quinzenal', 'Rotas por helper', 'Pagamento e gorjetas da equipe', 'Taxa de cancelamento automática', 'Site de agendamento grátis', 'Lembrete 24h antes'] },
      com: { title: 'Para contratos comerciais', text: 'Escritórios, clínicas e lojas: do walkthrough à proposta, contrato, equipe por local e ponto com localização. Pode assinar só o Comercial.', items: ['Walkthrough no celular', 'Proposta calculada em PDF', 'Contratos e reajustes', 'Ponto com geofence', 'Inspeções de qualidade', 'Lucro por contrato'] }
    };
    const on = { bg: '#FFFFFF', fg: '#0A3D35' }, off = { bg: 'transparent', fg: '#4E7770' };

    const bubbles = [
      { who: 'Você · português', text: 'Bianca, a família Patel pediu atenção no forno hoje.', bg: '#0B7C6E', fg: '#FFFFFF', align: 'flex-end', cls: 's2' },
      { who: 'Bianca lê · español', text: 'Bianca, la familia Patel pidió atención en el horno hoy.', bg: '#FFFFFF', fg: '#0A3D35', align: 'flex-start', cls: 's3' },
      { who: 'Cliente recebe · English', text: 'Your cleaning is confirmed for Friday at 1:00 PM.', bg: '#0A3D35', fg: '#EAF5F2', align: 'flex-end', cls: 's4' }
    ];

    const y = S.yearly;
    const fmt = (v) => '$' + (Number.isInteger(v) ? v : v.toFixed(2));
    const pr = (m) => y ? Math.round(m * 10 / 12 * 100) / 100 : m;
    const yearNote = (m) => y ? 'cobrado ' + fmt(m * 10) + ' por ano' : 'ou ' + fmt(Math.round(m * 10 / 12 * 100) / 100) + '/mês no anual';
    const T = [{ label: 'até 5', p: 49 }, { label: '6–15', p: 99 }, { label: '16–40', p: 179 }, { label: '40+', p: 0 }];
    const tier = T[S.tier];
    const tiers = T.map((t, i) => ({ label: t.label, sel: S.tier === i ? 'true' : 'false', bg: S.tier === i ? '#FFFFFF' : 'transparent', fg: S.tier === i ? '#0A3D35' : '#4E7770', go: () => this.setState({ tier: i }) }));
    const light = { bg: '#F7FBFA', fg: '#0A3D35', border: '#DCEAE6', check: '#0B7C6E', btnBg: '#0A3D35', btnFg: '#FFFFFF' };
    const plans = [
      Object.assign({ name: 'Essencial', desc: 'Para quem está começando ou trabalha sozinha.', price: fmt(pr(29)), per: '/mês', note: yearNote(29), items: ['Até 30 casas ativas', 'Até 3 usuários', 'Agenda, clientes e cobranças', 'Horas e gastos da equipe', 'Tradução PT · EN · ES', 'Alertas do Tidy'], badge: false, isCom: false, cta: 'Testar grátis' }, light),
      { name: 'Pro', desc: 'Para quem tem equipe e quer crescer.', price: fmt(pr(69)), per: '/mês', note: yearNote(69), items: ['Casas ilimitadas', 'Até 15 usuários', 'Rotas otimizadas e portal do cliente', 'Pagamento da equipe e relatório 1099', 'Exportação para QuickBooks', 'Revisão completa do Tidy'], bg: '#0A3D35', fg: '#EAF5F2', border: '#0A3D35', check: '#5FD4C1', btnBg: '#5FD4C1', btnFg: '#0A3D35', badge: true, isCom: false, cta: 'Testar grátis' },
      Object.assign({ name: 'Comercial', desc: 'Contratos com escritórios, clínicas e lojas. Pode assinar sozinho.', price: tier.p ? fmt(pr(tier.p)) : 'Sob consulta', per: tier.p ? '/mês' : '', note: tier.p ? 'Faixa de ' + tier.label + ' contratos' : 'Mais de 40 contratos: preço sob medida', items: ['Walkthrough e propostas', 'Contratos e reajustes', 'Ponto com geofence', 'Cobertura de turnos pelo Tidy', 'Inspeções de qualidade', 'Lucro por contrato'], badge: false, isCom: true, cta: tier.p ? 'Testar grátis' : 'Falar com a gente' }, light)
    ];
    const combo = Math.round((69 + 49) * 0.8 * 100) / 100;
    const comboText = y ? 'Pro + Comercial (até 5 contratos): ' + fmt(Math.round(combo * 10 / 12 * 100) / 100) + '/mês no anual, em vez de ' + fmt(Math.round(118 * 10 / 12 * 100) / 100) + '.' : 'Pro + Comercial (até 5 contratos): ' + fmt(combo) + '/mês em vez de $118. O desconto vale em todas as faixas.';
    const guarantees = [
      { icon: I.card, title: '14 dias sem cartão', text: 'Tudo liberado no teste.' },
      { icon: I.unlock, title: 'Sem contrato', text: 'Mensal, sem fidelidade.' },
      { icon: I.download, title: 'Seus dados são seus', text: 'Exporte tudo quando quiser.' },
      { icon: I.x, title: 'Cancele no app', text: 'Em 2 toques, sem ligar para ninguém.' }
    ];
    const included = ['Importação de dados', 'Chamada de configuração', 'Suporte por chat e WhatsApp', 'App da helper', 'Portal do cliente', 'Tradução PT · EN · ES', 'Lembretes por e-mail e push', 'Atualizações sem custo'];

    const F = [
      ['Preciso de cartão para testar?', 'Não. São 14 dias grátis com todos os recursos do plano escolhido. Você só cadastra o cartão se decidir continuar.'],
      ['Vocês importam meus clientes do app que eu uso hoje?', 'Sim, sem custo. Mande a planilha ou o arquivo exportado do seu app atual e a gente importa clientes, endereços, preços e recorrências. Você revisa antes de ativar.'],
      ['E se o app travar no meio do dia?', 'O app da helper funciona sem internet: checklist, fotos e horas ficam salvos no celular e sincronizam quando o sinal volta. A página de status do sistema é pública.'],
      ['Como meus clientes pagam?', 'O cliente recebe a fatura em PDF com os seus dados de Zelle, Venmo ou cheque. Quando ele pagar, você registra em um toque e a fatura fecha. Cartão e ACH pela Stripe chegam em breve.'],
      ['Ajuda com o pagamento da equipe e com o contador?', 'Sim. O app soma horas, gorjetas e reembolsos de cada helper, gera o relatório do período e o resumo anual para o 1099, e exporta para o QuickBooks.'],
      ['Como é o suporte?', 'Pessoas de verdade por chat e WhatsApp, em português, inglês e espanhol, e chamada agendada por vídeo ou telefone quando precisar.'],
      ['Minha equipe precisa baixar algum app?', 'Não. O Tidyo funciona no navegador e pode ser instalado na tela do celular em um toque. A helper entra por um link enviado no WhatsApp.'],
      ['Posso usar só para contratos comerciais?', 'Pode. O plano Comercial é vendido sozinho, com preço pela quantidade de contratos. Se atender casas também, o combo com o Pro tem 20% de desconto.'],
      ['Meus dados são meus?', 'São. Você exporta clientes, faturas e relatórios em CSV a qualquer momento, inclusive depois de cancelar.'],
      ['Meus dados ficam seguros?', 'Cada empresa tem os dados isolados, o acesso usa verificação em duas etapas e o Tidyo não guarda números de cartão.']
    ];
    const faqs = F.map(([q, a], i) => { const open = S.open === i; return { q, a, open, exp: open ? 'true' : 'false', rot: open ? 180 : 0, toggle: () => this.setState({ open: this.state.open === i ? -1 : i }) }; });

    const sj = { 'Concluído': ['#E3F1EE', '#0B6B5F'], 'Em curso': ['#FDF0DC', '#8A4B05'], 'Agendado': ['#EEF1F0', '#3E4F4C'] };
    const mockJobs = [['8:00', 'Família Cohen', 'Waterbury · Bianca', 'Concluído'], ['9:30', 'Northgate Offices', 'Middlebury · Marcos', 'Em curso'], ['10:30', 'Família Rossi', 'Naugatuck · Bianca', 'Em curso'], ['13:00', 'Família Nguyen', 'Prospect · Joana', 'Agendado']]
      .map(([t, c, a, s]) => ({ t, c, a, s, bg: sj[s][0], fg: sj[s][1] }));

    const chatOptions = [
      { title: 'Conversar no WhatsApp', text: 'Resposta em minutos no horário comercial', href: '#', icon: I.chat, bg: '#D4F1E9', fg: '#0A3D35' },
      { title: 'Agendar chamada grátis', text: '30 min por vídeo ou telefone', href: '/comecar', icon: I.phone, bg: '#0A3D35', fg: '#5FD4C1' },
      { title: 'Central de ajuda', text: 'Guias com passo a passo', href: '#duvidas', icon: I.doc, bg: '#E3F5EF', fg: '#0B7C6E' }
    ];
    const popupItems = ['Importação dos seus clientes, endereços e recorrências', 'Chamada de 30 minutos no seu idioma para configurar', '14 dias grátis, sem cartão'];

    const paused = !S.playing;
    return {
      heroTrust, chapters, demoTasks, pains, personaTabs, persona, ownerSide, helperSide, features, insights, compare, switchSteps,
      bubbles, plans, tiers, comboText, guarantees, included, faqs, mockJobs, chatOptions, popupItems,
      s0: S.scene === 0, s1: S.scene === 1, s2: S.scene === 2, s3: S.scene === 3,
      sceneNum: S.scene + 1, sceneLabel: 'Demonstração do app, sem som: ' + cur.title,
      caption: { who: cur.who, title: cur.capT, text: cur.capX },
      playCls: paused ? 'paused' : '',
      playLabel: paused ? 'Reproduzir demonstração' : 'Pausar demonstração',
      playText: paused ? 'Reproduzir' : 'Pausar',
      playIcon: paused ? 'M8 5.5v13l11-6.5z' : 'M7 5h4v14H7zM13 5h4v14h-4z',
      togglePlay: () => this.setState({ playing: !this.state.playing }),
      mode: M[S.mode], tabA: S.mode === 'res' ? on : off, tabB: S.mode === 'com' ? on : off,
      resSel: S.mode === 'res' ? 'true' : 'false', comSel: S.mode === 'com' ? 'true' : 'false',
      setRes: () => this.setState({ mode: 'res' }), setCom: () => this.setState({ mode: 'com' }),
      billA: y ? off : on, billB: y ? on : off, mSel: y ? 'false' : 'true', ySel: y ? 'true' : 'false',
      setMonthly: () => this.setState({ yearly: false }), setYearly: () => this.setState({ yearly: true }),
      chat: S.chat, chatExp: S.chat ? 'true' : 'false', chatLabel: S.chat ? 'Fechar conversa' : 'Abrir conversa com a equipe',
      toggleChat: () => this.setState({ chat: !this.state.chat }),
      openChat: () => this.setState({ chat: true }), closeChat: () => this.setState({ chat: false }),
      popup: S.popup || (!!P.showPopup && !S.popupSeen),
      openPopup: () => this.setState({ popup: true, popupSeen: true }),
      closePopup: () => this.setState({ popup: false, popupSeen: true })
    };
  }
}


export default function Landing() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const ref = useRef<any>(null);
  if (!ref.current) ref.current = new LandingLogic({});
  const inst = ref.current;
  inst._update = force;
  useEffect(() => { inst.componentDidMount?.(); return () => inst.componentWillUnmount?.(); }, []);
  const v = inst.renderVals();
  return (
    <div style={{ background: "#F7FBFA", color: "#0A3D35", fontFamily: "Manrope, 'Segoe UI', sans-serif", fontSize: "16px", lineHeight: "1.55", overflowX: "hidden", position: "relative" }}>

  <header style={{ position: "sticky", top: "0", zIndex: "30", background: "rgba(247,251,250,0.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid #DCEAE6" }}>
    <div className="wrap" style={{ display: "flex", alignItems: "center", gap: "18px", minHeight: "68px" }}>
      <a href="#" aria-label="Tidyo, início" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "#0A3D35" }}>
        <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="17" fill="#D4F1E9"></rect>
          <g transform="translate(11 8.5) scale(0.7)">
            <rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F"></rect>
            <rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35"></rect>
            <path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round"></path>
          </g>
        </svg>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.035em" }}>tidyo</span>
      </a>
      <nav className="navlinks" aria-label="Seções" style={{ marginLeft: "18px" }}>
        <a href="#demo" style={{ color: "#2F5B54", textDecoration: "none", fontWeight: "700", fontSize: "15px" }}>Veja funcionando</a>
        <a href="#para-quem" style={{ color: "#2F5B54", textDecoration: "none", fontWeight: "700", fontSize: "15px" }}>Para quem</a>
        <a href="#trocar" style={{ color: "#2F5B54", textDecoration: "none", fontWeight: "700", fontSize: "15px" }}>Por que trocar</a>
        <a href="#precos" style={{ color: "#2F5B54", textDecoration: "none", fontWeight: "700", fontSize: "15px" }}>Preços</a>
        <a href="#duvidas" style={{ color: "#2F5B54", textDecoration: "none", fontWeight: "700", fontSize: "15px" }}>Dúvidas</a>
      </nav>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
        <span className="hide-sm" style={{ fontSize: "13px", fontWeight: "800", color: "#2F5B54", border: "1px solid #CFE2DD", borderRadius: "10px", padding: "6px 10px" }}>PT · EN · ES</span>
        <a href="/entrar" style={{ minHeight: "44px", boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 16px", borderRadius: "12px", border: "1.5px solid #0A3D35", color: "#0A3D35", fontWeight: "800", fontSize: "14px", textDecoration: "none", whiteSpace: "nowrap" }}>Já sou cliente · Entrar</a>
        <a href="/comecar" className="cta-primary hide-sm" style={{ minHeight: "44px", boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 18px", borderRadius: "12px", background: "#0B7C6E", color: "#FFFFFF", fontWeight: "800", fontSize: "14px", textDecoration: "none", whiteSpace: "nowrap" }}>Testar grátis</a>
      </div>
    </div>
  </header>

  
  <section style={{ position: "relative", paddingBlock: "64px 80px" }}>
    <div aria-hidden="true" style={{ position: "absolute", right: "-160px", top: "-120px", width: "620px", height: "620px", borderRadius: "620px", background: "#E3F5EF" }}></div>
    <div className="wrap hero-grid" style={{ position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "22px", minWidth: "0" }}>
        <span style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", fontWeight: "800", color: "#0B6B5F", background: "#D4F1E9", borderRadius: "999px", padding: "7px 14px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"></path></svg>
          Para autônomas, empresas com equipe e helpers
        </span>
        <h1 className="h1" style={{ margin: "0", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: "800", lineHeight: "1.02", letterSpacing: "-0.035em", textWrap: "balance" }}>O app da sua limpeza que não trava, cobra por você e fala três idiomas.</h1>
        <p style={{ margin: "0", fontSize: "19px", color: "#2F5B54", maxWidth: "560px", textWrap: "pretty" }}>Agenda, rotas, equipe, horas, cobranças e financeiro num lugar só. O Tidy, seu assistente, revisa tudo todo dia e avisa só o que precisa de atenção.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <a href="/comecar" className="cta-primary" style={{ minHeight: "56px", boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 26px", borderRadius: "16px", background: "#0B7C6E", color: "#FFFFFF", fontWeight: "800", fontSize: "16.5px", textDecoration: "none" }}>Testar grátis por 14 dias</a>
          <a href="#demo" style={{ minHeight: "56px", boxSizing: "border-box", display: "flex", alignItems: "center", gap: "8px", padding: "0 22px", borderRadius: "16px", background: "#FFFFFF", border: "1px solid #CFE2DD", color: "#0A3D35", fontWeight: "800", fontSize: "16px", textDecoration: "none" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A3D35" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"></path></svg>
            Ver o app em 20 segundos
          </a>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
          {(v.heroTrust || []).map((t: any, __i5: number) => (<Fragment key={__i5}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#2F5B54", fontWeight: "700" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg>{t}</span>
          </Fragment>))}
        </div>
      </div>

      <div style={{ position: "relative", height: "620px", display: "flex", justifyContent: "center", minWidth: "0" }}>
        <div className="float s4" aria-hidden="true" style={{ position: "absolute", left: "4%", top: "40px", width: "58px", height: "58px", borderRadius: "18px", background: "#FFFFFF", boxShadow: "0 10px 24px rgba(10,61,53,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 8h6l1 13H8zM10 8V5h4v3M14 5h3l2 2M17 3v1"></path></svg>
        </div>
        <div className="float s2" aria-hidden="true" style={{ position: "absolute", right: "2%", top: "110px", width: "52px", height: "52px", borderRadius: "52px", background: "#0A3D35", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(10,61,53,.25)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5FD4C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path></svg>
        </div>
        <div className="float s3" aria-hidden="true" style={{ position: "absolute", left: "0", bottom: "120px", width: "54px", height: "54px", borderRadius: "16px", background: "#D4F1E9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A3D35" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"></path></svg>
        </div>

        <div role="img" aria-label="Tela inicial do app Tidyo no celular" style={{ position: "relative", width: "296px", height: "600px", boxSizing: "border-box", borderRadius: "44px", background: "#0A3D35", padding: "10px", boxShadow: "0 30px 60px rgba(10,61,53,.28)" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "35px", background: "#F4F7F6", overflow: "hidden", display: "flex", flexDirection: "column", gap: "12px", padding: "22px 14px", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="17" fill="#D4F1E9"></rect><g className="tidy-sweep"><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F"></rect><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35"></rect><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round"></path></g></g></svg>
              <div style={{ display: "flex", flexDirection: "column", flexGrow: "1" }}><span style={{ fontSize: "9.5px", color: "#566965", fontWeight: "700" }}>Qui, 15 de outubro</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "15px", fontWeight: "800" }}>Bom dia, Carla</span></div>
              <span style={{ position: "relative", width: "30px", height: "30px", borderRadius: "10px", background: "#0F1F1C", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="#5FD4C1" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"></path></svg><span style={{ position: "absolute", top: "-4px", right: "-4px", width: "15px", height: "15px", borderRadius: "15px", background: "#D9480F", color: "#FFFFFF", fontSize: "8.5px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>4</span></span>
            </div>
            <div style={{ background: "#FFF3EC", border: "1px solid #F5D3C2", borderRadius: "10px", padding: "7px 8px", display: "flex", alignItems: "center", gap: "6px" }}><span style={{ fontSize: "9.5px", fontWeight: "700", color: "#6B2A0A", flexGrow: "1" }}>Conflito: Bianca em 2 casas às 10:00</span><span style={{ fontSize: "9px", fontWeight: "800", color: "#FFFFFF", background: "#B8400C", borderRadius: "6px", padding: "3px 6px" }}>Resolver</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
              <div style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "10px", padding: "7px" }}><span style={{ display: "block", fontSize: "7.5px", fontWeight: "800", color: "#566965" }}>JOBS HOJE</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "17px", fontWeight: "800" }}>7</span></div>
              <div style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "10px", padding: "7px" }}><span style={{ display: "block", fontSize: "7.5px", fontWeight: "800", color: "#566965" }}>A RECEBER</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "17px", fontWeight: "800" }}>$4.8k</span></div>
              <div style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "10px", padding: "7px" }}><span style={{ display: "block", fontSize: "7.5px", fontWeight: "800", color: "#566965" }}>SAÚDE</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "17px", fontWeight: "800", color: "#0B7C6E" }}>78</span></div>
            </div>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "13px", fontWeight: "800" }}>Agenda de hoje</span>
            {(v.mockJobs || []).map((j: any, __i6: number) => (<Fragment key={__i6}>
              <div style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "10px", padding: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "10px", fontWeight: "800", width: "30px" }}>{j.t}</span>
                <span style={{ display: "flex", flexDirection: "column", flexGrow: "1", minWidth: "0" }}><span style={{ fontSize: "10.5px", fontWeight: "800" }}>{j.c}</span><span style={{ fontSize: "8.5px", color: "#566965" }}>{j.a}</span></span>
                <span style={{ fontSize: "8px", fontWeight: "800", borderRadius: "999px", padding: "2px 6px", background: j.bg, color: j.fg }}>{j.s}</span>
              </div>
            </Fragment>))}
          </div>
        </div>

        <div className="float s2" style={{ position: "absolute", left: "-2%", top: "200px", background: "#FFFFFF", borderRadius: "16px", padding: "12px 14px", boxShadow: "0 16px 36px rgba(10,61,53,.16)", display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ width: "36px", height: "36px", borderRadius: "11px", background: "#0A3D35", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5FD4C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"></path></svg></span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: "1.25" }}><span style={{ fontSize: "12px", fontWeight: "700", color: "#4E7770" }}>Rota otimizada</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "18px", fontWeight: "800" }}>−48 min</span></span>
        </div>
        <div className="float s3" style={{ position: "absolute", right: "-3%", top: "330px", background: "#FFFFFF", borderRadius: "16px", padding: "12px 14px", boxShadow: "0 16px 36px rgba(10,61,53,.16)", display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ width: "36px", height: "36px", borderRadius: "11px", background: "#D4F1E9", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A3D35" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg></span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: "1.25" }}><span style={{ fontSize: "12px", fontWeight: "700", color: "#4E7770" }}>Fatura paga</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "18px", fontWeight: "800" }}>$180.00</span></span>
        </div>
        <div className="float s4" style={{ position: "absolute", left: "6%", bottom: "26px", background: "#0A3D35", color: "#FFFFFF", borderRadius: "16px", padding: "10px 14px", boxShadow: "0 16px 36px rgba(10,61,53,.25)", fontSize: "13px", fontWeight: "700" }}>
          Bianca fez check-in · 8:12
        </div>
      </div>
    </div>
  </section>

  
  <section id="demo" style={{ paddingBlock: "88px", background: "#0A3D35", color: "#EAF5F2", position: "relative", overflow: "hidden" }}>
    <div aria-hidden="true" style={{ position: "absolute", right: "-140px", top: "-140px", width: "460px", height: "460px", borderRadius: "460px", background: "#0F4A41" }}></div>
    <div className="wrap" style={{ position: "relative", display: "flex", flexDirection: "column", gap: "40px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "720px" }}>
        <span className="eyebrow" style={{ color: "#5FD4C1" }}>Veja funcionando</span>
        <h2 className="h2">Um dia inteiro da sua empresa em 20 segundos.</h2>
        <p style={{ margin: "0", fontSize: "17px", color: "#B9D6D0" }}>Do Tidy revisando a agenda às 5h até a fatura paga no fim da tarde. Sem som, pode assistir em qualquer lugar.</p>
      </div>
      <div className="demo-grid">
        <div role="tablist" aria-label="Partes do vídeo" style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "0" }}>
          {(v.chapters || []).map((c: any, __i5: number) => (<Fragment key={__i5}>
            <button role="tab" aria-selected={c.sel} onClick={c.go} style={{ position: "relative", overflow: "hidden", textAlign: "left", minHeight: "72px", borderRadius: "18px", border: `1px solid ${c.border}`, background: c.bg, color: "#EAF5F2", padding: "14px 16px", cursor: "pointer", display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ flex: "none", width: "34px", height: "34px", borderRadius: "34px", background: c.numBg, color: c.numFg, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.n}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontWeight: "800", fontSize: "16px" }}>{c.title}</span><span style={{ fontSize: "13.5px", color: "#9DB5B0" }}>{c.sub}</span></span>
              <span aria-hidden="true" style={{ position: "absolute", left: "0", bottom: "0", height: "3px", width: `${c.prog}%`, background: "#5FD4C1" }}></span>
            </button>
          </Fragment>))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", minWidth: "0" }}>
          <div className={v.playCls} role="img" aria-label={v.sceneLabel} style={{ position: "relative", width: "296px", height: "600px", boxSizing: "border-box", borderRadius: "44px", background: "#061F1B", padding: "10px", boxShadow: "0 30px 60px rgba(0,0,0,.35)" }}>
            <div style={{ position: "absolute", top: "18px", left: "20px", right: "20px", zIndex: "3", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "4px" }}>
              {(v.chapters || []).map((c: any, __i7: number) => (<Fragment key={__i7}>
                <span style={{ height: "3px", borderRadius: "3px", background: "rgba(15,31,28,.18)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${c.prog}%`, background: "#0B7C6E" }}></span></span>
              </Fragment>))}
            </div>
            <div style={{ width: "100%", height: "100%", borderRadius: "35px", background: "#F4F7F6", overflow: "hidden", position: "relative", color: "#0F1F1C" }}>

              {!!(v.s0) && (<>
                <div style={{ position: "absolute", inset: "0", padding: "34px 14px 14px", display: "flex", flexDirection: "column", gap: "10px", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "10px", fontWeight: "700", color: "#566965", flexGrow: "1" }}>Qui, 15 out · 5:00</span><span style={{ fontSize: "9px", fontWeight: "800", background: "#D4F1E9", color: "#0A3D35", borderRadius: "999px", padding: "2px 7px" }}>Carla · dona</span></div>
                  <div style={{ background: "#0F1F1C", borderRadius: "18px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px", color: "#FFFFFF" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "24px", height: "24px", borderRadius: "24px", background: "#5FD4C1", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="#0F1F1C" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"></path></svg></span><span style={{ fontSize: "12px", fontWeight: "800" }}>Tidy revisou o seu dia</span></div>
                    <div className="pop d1" style={{ borderTop: "1px solid #23383A", paddingTop: "8px" }}><span style={{ fontSize: "8px", fontWeight: "800", background: "#5A2416", color: "#FFB59C", borderRadius: "4px", padding: "2px 5px" }}>CONFLITO</span><span style={{ display: "block", fontSize: "11px", fontWeight: "700", marginTop: "4px" }}>Bianca está em 2 casas às 10:00</span><span style={{ display: "block", fontSize: "9.5px", color: "#9DB5B0" }}>Sugestão: Miller vai para a Joana</span></div>
                    <div className="pop d2" style={{ borderTop: "1px solid #23383A", paddingTop: "8px" }}><span style={{ fontSize: "8px", fontWeight: "800", background: "#4A1A1A", color: "#FF9C9C", borderRadius: "4px", padding: "2px 5px" }}>COBRANÇA</span><span style={{ display: "block", fontSize: "11px", fontWeight: "700", marginTop: "4px" }}>3 faturas vencidas · $1,240</span></div>
                    <div className="pop d3" style={{ borderTop: "1px solid #23383A", paddingTop: "8px" }}><span style={{ fontSize: "8px", fontWeight: "800", background: "#4A3510", color: "#F5C66B", borderRadius: "4px", padding: "2px 5px" }}>EQUIPE</span><span style={{ display: "block", fontSize: "11px", fontWeight: "700", marginTop: "4px" }}>Marcos: 41h na semana, perto do limite</span></div>
                  </div>
                  <div className="pop d4 tap" style={{ minHeight: "36px", borderRadius: "12px", background: "#0B7C6E", color: "#FFFFFF", fontSize: "11.5px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>Resolver conflito em 1 toque</div>
                  <div className="pop d5" style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "12px", padding: "9px", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ width: "22px", height: "22px", borderRadius: "22px", background: "#D4F1E9", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A3D35" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg></span><span style={{ fontSize: "10.5px", fontWeight: "700" }}>Miller passou para a Joana. Cliente e equipe avisados.</span></div>
                  <div className="pop d6" style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "12px", padding: "9px", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ width: "22px", height: "22px", borderRadius: "22px", background: "#FDF0DC", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A4B05" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"></path></svg></span><span style={{ fontSize: "10.5px", fontWeight: "700" }}>3 lembretes de pagamento enviados</span></div>
                </div>
              </>)}

              {!!(v.s1) && (<>
                <div style={{ position: "absolute", inset: "0", padding: "34px 14px 14px", display: "flex", flexDirection: "column", gap: "10px", boxSizing: "border-box" }}>
                  <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "15px", fontWeight: "800" }}>Rota de Bianca · amanhã</span>
                  <div style={{ position: "relative", height: "250px", borderRadius: "16px", background: "#E6EEEC", overflow: "hidden" }}>
                    <svg width="100%" height="100%" viewBox="0 0 252 250" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0 60 H252 M0 140 H252 M0 205 H252 M60 0 V250 M150 0 V250 M210 0 V250" stroke="#FFFFFF" strokeWidth="7"></path>
                      <path d="M30 220 L60 205 L60 140 L150 140 L150 60 L210 60 L222 30" fill="none" stroke="#0B7C6E" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="draw"></path>
                      <circle cx="30" cy="220" r="9" fill="#0A3D35"></circle>
                      <circle cx="60" cy="140" r="9" fill="#12A38F"></circle>
                      <circle cx="150" cy="60" r="9" fill="#12A38F"></circle>
                      <circle cx="222" cy="30" r="9" fill="#12A38F"></circle>
                      <text x="30" y="224" textAnchor="middle" fontSize="10" fontWeight="800" fill="#FFFFFF">C</text>
                      <text x="60" y="144" textAnchor="middle" fontSize="10" fontWeight="800" fill="#FFFFFF">1</text>
                      <text x="150" y="64" textAnchor="middle" fontSize="10" fontWeight="800" fill="#FFFFFF">2</text>
                      <text x="222" y="34" textAnchor="middle" fontSize="10" fontWeight="800" fill="#FFFFFF">3</text>
                    </svg>
                  </div>
                  <div className="pop d4" style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "14px", padding: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "8.5px", fontWeight: "800", color: "#566965" }}>ANTES</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "18px", fontWeight: "800", color: "#8A9C98", textDecoration: "line-through" }}>2h10</span></span>
                    <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: "8.5px", fontWeight: "800", color: "#566965" }}>COM O TIDY</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "18px", fontWeight: "800", color: "#0B7C6E" }}>1h22 · −48 min</span></span>
                  </div>
                  <div className="pop d5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <span style={{ minHeight: "34px", borderRadius: "10px", background: "#0B7C6E", color: "#FFFFFF", fontSize: "10.5px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>Aplicar rota</span>
                    <span style={{ minHeight: "34px", borderRadius: "10px", background: "#FFFFFF", border: "1px solid #DFE7E5", fontSize: "10.5px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>Abrir no Waze</span>
                  </div>
                </div>
              </>)}

              {!!(v.s2) && (<>
                <div style={{ position: "absolute", inset: "0", padding: "34px 14px 14px", display: "flex", flexDirection: "column", gap: "9px", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "15px", fontWeight: "800", flexGrow: "1" }}>Casa Cohen · Cocina</span><span style={{ fontSize: "8.5px", fontWeight: "800", background: "#FDF0DC", color: "#8A4B05", borderRadius: "999px", padding: "2px 7px", display: "flex", alignItems: "center", gap: "4px" }}><span className="pulse-dot" style={{ width: "5px", height: "5px", borderRadius: "5px", background: "#8A4B05" }}></span>Sin señal · se guarda</span></div>
                  <span style={{ fontSize: "9.5px", color: "#566965", fontWeight: "700" }}>Bianca · en español · 2h46 hoy</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <div style={{ height: "74px", borderRadius: "12px", background: "#CBB8A4", position: "relative" }}><span style={{ position: "absolute", left: "6px", bottom: "6px", fontSize: "8.5px", fontWeight: "800", background: "rgba(15,31,28,.75)", color: "#FFFFFF", borderRadius: "5px", padding: "2px 5px" }}>Antes · 8:14</span></div>
                    <div className="pop d5" style={{ height: "74px", borderRadius: "12px", background: "#CDEBE3", position: "relative" }}><span style={{ position: "absolute", left: "6px", bottom: "6px", fontSize: "8.5px", fontWeight: "800", background: "rgba(15,31,28,.75)", color: "#FFFFFF", borderRadius: "5px", padding: "2px 5px" }}>Después · 9:02</span></div>
                  </div>
                  {(v.demoTasks || []).map((k: any, __i9: number) => (<Fragment key={__i9}>
                    <div style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "11px", padding: "8px 9px", display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ position: "relative", width: "18px", height: "18px", borderRadius: "6px", border: "1.5px solid #B9C7C4", flex: "none" }}>
                        <span className={`pop ${k.d}`} style={{ position: "absolute", inset: "-1.5px", borderRadius: "6px", background: "#0B7C6E", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg></span>
                      </span>
                      <span style={{ fontSize: "10.5px", fontWeight: "700" }}>{k.t}</span>
                    </div>
                  </Fragment>))}
                </div>
              </>)}

              {!!(v.s3) && (<>
                <div style={{ position: "absolute", inset: "0", padding: "34px 14px 14px", display: "flex", flexDirection: "column", gap: "10px", boxSizing: "border-box" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "#566965" }}>What the client sees · English</span>
                  <div style={{ position: "relative", background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "18px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "9px", fontWeight: "800", color: "#566965" }}>INVOICE #1042 · COHEN FAMILY</span>
                    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "30px", fontWeight: "800" }}>$180.00</span>
                    <span style={{ fontSize: "10px", color: "#566965" }}>Recurring clean · Oct 15 · Bianca</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "4px" }}>
                      <span className="tap" style={{ minHeight: "34px", borderRadius: "10px", background: "#0A3D35", color: "#FFFFFF", fontSize: "10.5px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>Pay by card</span>
                      <span style={{ minHeight: "34px", borderRadius: "10px", background: "#F4F7F6", fontSize: "10.5px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>Bank (ACH)</span>
                    </div>
                    <span className="stamp" style={{ position: "absolute", right: "12px", top: "20px", border: "2.5px solid #0B7C6E", color: "#0B7C6E", borderRadius: "8px", padding: "2px 8px", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: "800", fontSize: "16px", letterSpacing: ".06em" }}>PAID</span>
                  </div>
                  <div className="pop d4" style={{ background: "#FFFFFF", border: "1px solid #DFE7E5", borderRadius: "14px", padding: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "800" }}>How was today's cleaning?</span>
                    <span style={{ fontSize: "18px", color: "#E8A317", letterSpacing: "2px" }} aria-hidden="true">★★★★★</span>
                  </div>
                  <div className="pop d5" style={{ background: "#0F1F1C", color: "#FFFFFF", borderRadius: "14px", padding: "10px", display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ width: "24px", height: "24px", borderRadius: "24px", background: "#5FD4C1", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F1F1C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg></span>
                    <span style={{ fontSize: "10.5px", fontWeight: "700" }}>Carla recebe: fatura paga · $180 · avaliação 5 estrelas</span>
                  </div>
                </div>
              </>)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={v.togglePlay} aria-label={v.playLabel} style={{ minWidth: "44px", minHeight: "44px", borderRadius: "44px", border: "1px solid #2A5A52", background: "#0F4A41", color: "#EAF5F2", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "0 14px", cursor: "pointer", fontWeight: "800", fontSize: "13.5px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#EAF5F2" aria-hidden="true"><path d={v.playIcon}></path></svg>
              {v.playText}
            </button>
            <span style={{ fontSize: "12.5px", color: "#9DB5B0", fontWeight: "700" }}>Sem som · {v.sceneNum} de 4</span>
          </div>
        </div>

        <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: "0" }}>
          <span style={{ fontSize: "13px", fontWeight: "800", color: "#5FD4C1" }}>{v.caption.who}</span>
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "28px", fontWeight: "800", lineHeight: "1.12", letterSpacing: "-0.02em", color: "#FFFFFF" }}>{v.caption.title}</span>
          <span style={{ fontSize: "16px", color: "#B9D6D0", lineHeight: "1.55" }}>{v.caption.text}</span>
          <a href="/comecar" className="cta-primary" style={{ alignSelf: "flex-start", minHeight: "50px", boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 20px", borderRadius: "14px", background: "#5FD4C1", color: "#0A3D35", fontWeight: "800", fontSize: "15px", textDecoration: "none" }}>Testar com dados de exemplo</a>
        </div>
      </div>
    </div>
  </section>

  
  <section style={{ paddingBlock: "72px", background: "#FFFFFF", borderBottom: "1px solid #E4EFEC" }}>
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "720px" }}>
        <span className="eyebrow" style={{ color: "#B8400C" }}>O que faz sua empresa perder dinheiro</span>
        <h2 className="h2">Planilha, WhatsApp e memória não dão conta de uma empresa que cresce.</h2>
      </div>
      <div className="g4">
        {(v.pains || []).map((p: any, __i4: number) => (<Fragment key={__i4}>
          <div className="card-lift" style={{ background: "#FFF8F4", border: "1px solid #F6DDD0", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ width: "46px", height: "46px", borderRadius: "14px", background: "#FDE6DA", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8400C" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={p.icon}></path></svg>
            </span>
            <span style={{ fontSize: "15px", fontWeight: "800", color: "#6B2A0A" }}>{p.title}</span>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "34px", fontWeight: "800", lineHeight: "1", letterSpacing: "-0.02em", color: "#8F2F08" }}>{p.stat}</span>
            <span style={{ fontSize: "14px", color: "#6B4A3C", lineHeight: "1.5" }}>{p.text}</span>
          </div>
        </Fragment>))}
      </div>
      <span style={{ fontSize: "12.5px", color: "#6B7F7B", lineHeight: "1.5" }}>Fontes: pesquisa Gateway Commercial Finance com 500+ pequenas empresas dos EUA (2025, citada pela Xero); Maptive, Field Service Route Optimization (2026); Hasvold e Wootton, Journal of Telemedicine and Telecare (2011), estudo em saúde.</span>
    </div>
  </section>

  
  <section id="para-quem" style={{ paddingBlock: "88px" }}>
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "760px" }}>
        <span className="eyebrow">Para quem é</span>
        <h2 className="h2">Feito para os três lados da limpeza.</h2>
        <p style={{ margin: "0", fontSize: "17px", color: "#3E5A55" }}>Quem trabalha sozinha, quem tem equipe e quem está em campo têm dores diferentes. O Tidyo mostra a cada um só o que importa.</p>
      </div>
      <div role="tablist" aria-label="Perfil" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", background: "#E4EFEC", borderRadius: "16px", padding: "5px", gap: "5px", maxWidth: "640px" }}>
        {(v.personaTabs || []).map((t: any, __i4: number) => (<Fragment key={__i4}>
          <button role="tab" aria-selected={t.sel} onClick={t.go} style={{ minHeight: "48px", borderRadius: "12px", border: "0", background: t.bg, color: t.fg, fontWeight: "800", fontSize: "14.5px", cursor: "pointer", padding: "0 8px" }}>{t.label}</button>
        </Fragment>))}
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCEAE6", borderRadius: "26px", padding: "28px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "760px" }}>
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.02em" }}>{v.persona.title}</span>
          <span style={{ fontSize: "16px", color: "#3E5A55" }}>{v.persona.text}</span>
        </div>
        <div className="cmp-head" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", fontSize: "12.5px", fontWeight: "800", letterSpacing: ".08em", textTransform: "uppercase" }}>
          <span style={{ color: "#B8400C" }}>A dor de hoje</span><span style={{ color: "#0B7C6E" }}>Como o Tidyo resolve</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(v.persona.rows || []).map((r: any, __i5: number) => (<Fragment key={__i5}>
            <div className="g2" style={{ gap: "16px", alignItems: "stretch" }}>
              <div style={{ background: "#FFF8F4", border: "1px solid #F6DDD0", borderRadius: "16px", padding: "14px 16px", display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "15px", color: "#6B2A0A", fontWeight: "600" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8400C" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}><path d="M6 6l12 12M18 6L6 18"></path></svg>{r.pain}
              </div>
              <div style={{ background: "#F1FAF7", border: "1px solid #CDE9E1", borderRadius: "16px", padding: "14px 16px", display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "15px", color: "#0A3D35", fontWeight: "600" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}><path d="M5 12l5 5L20 7"></path></svg>{r.fix}
              </div>
            </div>
          </Fragment>))}
        </div>
      </div>
    </div>
  </section>

  
  <section style={{ paddingBlock: "88px", background: "#FFFFFF", borderBlock: "1px solid #E4EFEC" }}>
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "760px" }}>
        <span className="eyebrow">Dois lados, um app</span>
        <h2 className="h2">Você controla tudo. A helper só abre e trabalha.</h2>
      </div>
      <div className="g2" style={{ alignItems: "stretch" }}>
        <div style={{ background: "#0A3D35", color: "#EAF5F2", borderRadius: "26px", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "44px", height: "44px", borderRadius: "14px", background: "#5FD4C1", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A3D35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"></path></svg></span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "800", color: "#FFFFFF" }}>O que a dona vê</span></span>
          {(v.ownerSide || []).map((o: any, __i5: number) => (<Fragment key={__i5}>
            <span style={{ display: "flex", gap: "10px", fontSize: "15.5px", color: "#D3E8E3" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5FD4C1" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "3px" }}><path d="M5 12l5 5L20 7"></path></svg>{o}</span>
          </Fragment>))}
          <a href="/entrar" style={{ alignSelf: "flex-start", marginTop: "auto", minHeight: "44px", display: "flex", alignItems: "center", color: "#5FD4C1", fontWeight: "800", textDecoration: "none" }}>Ver a tela da dona →</a>
        </div>
        <div style={{ background: "#F1FAF7", border: "1px solid #CDE9E1", borderRadius: "26px", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "44px", height: "44px", borderRadius: "14px", background: "#0A3D35", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5FD4C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path></svg></span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "800" }}>O que a helper vê</span></span>
          {(v.helperSide || []).map((o: any, __i5: number) => (<Fragment key={__i5}>
            <span style={{ display: "flex", gap: "10px", fontSize: "15.5px", color: "#2F5B54" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "3px" }}><path d="M5 12l5 5L20 7"></path></svg>{o}</span>
          </Fragment>))}
          <a href="/entrar" style={{ alignSelf: "flex-start", marginTop: "auto", minHeight: "44px", display: "flex", alignItems: "center", color: "#0B7C6E", fontWeight: "800", textDecoration: "none" }}>Ver a tela da helper →</a>
        </div>
      </div>
    </div>
  </section>

  
  <section id="recursos" style={{ position: "relative", paddingBlock: "88px", overflow: "hidden" }}>
    <div className="float s3" aria-hidden="true" style={{ position: "absolute", right: "4%", top: "70px", width: "64px", height: "64px", borderRadius: "20px", background: "#D4F1E9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0A3D35" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4"></path></svg>
    </div>
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "720px" }}>
        <span className="eyebrow">O Tidyo resolve</span>
        <h2 className="h2">Tudo o que sua operação precisa, pensado para quem limpa.</h2>
      </div>
      <div className="g3">
        {(v.features || []).map((f: any, __i4: number) => (<Fragment key={__i4}>
          <div className="card-lift" style={{ background: "#FFFFFF", border: "1px solid #DCEAE6", borderRadius: "22px", padding: "22px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ width: "46px", height: "46px", borderRadius: "14px", background: f.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={f.fg} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.icon}></path></svg>
            </span>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.01em" }}>{f.title}</span>
            <span style={{ fontSize: "15px", color: "#3E5A55", lineHeight: "1.55" }}>{f.text}</span>
          </div>
        </Fragment>))}
      </div>
    </div>
  </section>

  
  <section style={{ paddingBlock: "88px", background: "#0A3D35", color: "#EAF5F2", position: "relative", overflow: "hidden" }}>
    <div aria-hidden="true" style={{ position: "absolute", left: "-120px", bottom: "-160px", width: "420px", height: "420px", borderRadius: "420px", background: "#0F4A41" }}></div>
    <div className="wrap g2" style={{ position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
        <span className="eyebrow" style={{ color: "#5FD4C1" }}>Conheça o Tidy</span>
        <h2 className="h2" style={{ fontSize: "44px" }}>Seu assistente revisa a empresa inteira enquanto você dorme.</h2>
        <p style={{ margin: "0", fontSize: "17px", color: "#B9D6D0", maxWidth: "500px" }}>Todo dia às 5h, o Tidy confere agenda, rotas, horas da equipe, contratos e cobranças. Às 7h, você recebe só o que precisa de atenção, com o botão para resolver.</p>
        <a href="/comecar" className="cta-primary" style={{ alignSelf: "flex-start", minHeight: "52px", boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 22px", borderRadius: "15px", background: "#5FD4C1", color: "#0A3D35", fontWeight: "800", fontSize: "15.5px", textDecoration: "none" }}>Quero o Tidy na minha empresa</a>
      </div>
      <div style={{ background: "#0F1F1C", border: "1px solid #23383A", borderRadius: "26px", padding: "18px 18px 6px", boxShadow: "0 24px 50px rgba(0,0,0,.25)", minWidth: "0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ width: "36px", height: "36px", borderRadius: "36px", background: "#5FD4C1", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#0F1F1C" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"></path></svg></span>
          <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "800", fontSize: "16px", color: "#FFFFFF" }}>Revisão de hoje · 5:00</span><span style={{ fontSize: "12.5px", color: "#9DB5B0" }}>4 itens pedem atenção</span></span>
        </div>
        {(v.insights || []).map((i: any, __i4: number) => (<Fragment key={__i4}>
          <div style={{ display: "flex", gap: "12px", padding: "13px 0", borderTop: "1px solid #23383A", alignItems: "flex-start" }}>
            <span style={{ flex: "none", fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 7px", borderRadius: "6px", background: i.bg, color: i.fg }}>{i.tag}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontWeight: "700", fontSize: "14.5px", color: "#FFFFFF" }}>{i.title}</span><span style={{ fontSize: "13px", color: "#9DB5B0" }}>{i.detail}</span></span>
          </div>
        </Fragment>))}
      </div>
    </div>
  </section>

  
  <section id="trocar" style={{ paddingBlock: "88px" }}>
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "780px" }}>
        <span className="eyebrow">Por que trocar</span>
        <h2 className="h2">Já usa outro app e vive contornando os problemas dele?</h2>
        <p style={{ margin: "0", fontSize: "17px", color: "#3E5A55" }}>Juntamos as reclamações mais comuns de quem usa software de limpeza e construímos o Tidyo para não repetir nenhuma delas.</p>
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCEAE6", borderRadius: "26px", overflow: "hidden" }}>
        <div className="cmp-row cmp-head" style={{ borderTop: "0", background: "#F1F6F5", fontSize: "12.5px", fontWeight: "800", letterSpacing: ".08em", textTransform: "uppercase" }}>
          <span style={{ padding: "14px 20px", color: "#4E7770" }}></span>
          <span style={{ padding: "14px 20px", color: "#B8400C" }}>O que você ouve por aí</span>
          <span style={{ padding: "14px 20px", color: "#0B7C6E" }}>No Tidyo</span>
        </div>
        {(v.compare || []).map((c: any, __i4: number) => (<Fragment key={__i4}>
          <div className="cmp-row">
            <span style={{ padding: "18px 20px", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: "800", fontSize: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "36px", height: "36px", borderRadius: "11px", background: "#D4F1E9", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A3D35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={c.icon}></path></svg></span>{c.topic}
            </span>
            <span style={{ padding: "18px 20px", fontSize: "15px", color: "#6B4A3C", display: "flex", gap: "8px", alignItems: "flex-start" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8400C" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}><path d="M6 6l12 12M18 6L6 18"></path></svg>{c.them}</span>
            <span style={{ padding: "18px 20px", fontSize: "15px", color: "#0A3D35", fontWeight: "600", display: "flex", gap: "8px", alignItems: "flex-start", background: "#F6FCFA" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}><path d="M5 12l5 5L20 7"></path></svg>{c.us}</span>
          </div>
        </Fragment>))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "12px" }}>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.02em" }}>Mudar é fácil. A gente faz com você.</span>
        <div className="g3">
          {(v.switchSteps || []).map((s: any, __i5: number) => (<Fragment key={__i5}>
            <div className="card-lift" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "24px", borderRadius: "22px", background: "#FFFFFF", border: "1px solid #DCEAE6" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "40px", height: "40px", borderRadius: "40px", background: "#0A3D35", color: "#FFFFFF", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: "800", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.n}</span><span style={{ fontSize: "12px", fontWeight: "800", background: "#D4F1E9", color: "#0A3D35", borderRadius: "999px", padding: "3px 10px" }}>Grátis</span></span>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "21px", fontWeight: "800" }}>{s.title}</span>
              <span style={{ fontSize: "15px", color: "#3E5A55" }}>{s.text}</span>
            </div>
          </Fragment>))}
        </div>
      </div>
    </div>
  </section>

  
  <section style={{ paddingBlock: "88px", background: "#FFFFFF", borderBlock: "1px solid #E4EFEC" }}>
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "30px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", textAlign: "center", maxWidth: "720px" }}>
        <span className="eyebrow">Do seu jeito</span>
        <h2 className="h2">Casas, escritórios ou os dois.</h2>
      </div>
      <div role="tablist" aria-label="Tipo de operação" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", background: "#E4EFEC", borderRadius: "16px", padding: "5px", gap: "5px", width: "100%", maxWidth: "420px" }}>
        <button role="tab" onClick={v.setRes} aria-selected={v.resSel} style={{ minHeight: "48px", borderRadius: "12px", border: "0", background: v.tabA.bg, color: v.tabA.fg, fontWeight: "800", fontSize: "15px", cursor: "pointer" }}>Residencial</button>
        <button role="tab" onClick={v.setCom} aria-selected={v.comSel} style={{ minHeight: "48px", borderRadius: "12px", border: "0", background: v.tabB.bg, color: v.tabB.fg, fontWeight: "800", fontSize: "15px", cursor: "pointer" }}>Comercial</button>
      </div>
      <div style={{ width: "100%", background: "#F7FBFA", border: "1px solid #DCEAE6", borderRadius: "26px", padding: "28px", boxSizing: "border-box" }}>
        <div className="g2" style={{ alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "0" }}>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.02em" }}>{v.mode.title}</span>
            <span style={{ fontSize: "16px", color: "#3E5A55", lineHeight: "1.55" }}>{v.mode.text}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", minWidth: "0" }}>
            {(v.mode.items || []).map((m: any, __i6: number) => (<Fragment key={__i6}>
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "14.5px", fontWeight: "600" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}><path d="M5 12l5 5L20 7"></path></svg>
                <span>{m}</span>
              </div>
            </Fragment>))}
          </div>
        </div>
      </div>
    </div>
  </section>

  
  <section style={{ paddingBlock: "88px", position: "relative", overflow: "hidden" }}>
    <div className="wrap g2">
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: "0" }}>
        <span className="eyebrow">Três idiomas, uma conversa</span>
        <h2 className="h2">Você escreve em português. A helper lê em espanhol. O cliente, em inglês.</h2>
        <p style={{ margin: "0", fontSize: "17px", color: "#3E5A55", maxWidth: "520px" }}>Mensagens, avisos, faturas e relatórios chegam no idioma de cada um. O texto original fica guardado, e você pode desligar a tradução por cliente.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
        {(v.bubbles || []).map((b: any, __i4: number) => (<Fragment key={__i4}>
          <div className={`float ${b.cls}`} style={{ alignSelf: b.align, maxWidth: "360px", background: b.bg, color: b.fg, borderRadius: "20px", padding: "14px 16px", boxShadow: "0 12px 28px rgba(10,61,53,.10)", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: "800", opacity: "0.8" }}>{b.who}</span>
            <span style={{ fontSize: "15.5px", fontWeight: "600" }}>{b.text}</span>
          </div>
        </Fragment>))}
      </div>
    </div>
  </section>

  
  <section id="precos" style={{ paddingBlock: "88px", background: "#FFFFFF", borderBlock: "1px solid #E4EFEC" }}>
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "28px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", textAlign: "center", maxWidth: "720px" }}>
        <span className="eyebrow">Preços</span>
        <h2 className="h2">Preço simples. Sem taxa de setup, sem contrato.</h2>
        <p style={{ margin: "0", fontSize: "17px", color: "#3E5A55" }}>Todos os planos com 14 dias grátis, importação dos seus dados e suporte humano em três idiomas.</p>
      </div>
      <div role="group" aria-label="Período de cobrança" style={{ display: "flex", background: "#E4EFEC", borderRadius: "14px", padding: "4px", gap: "4px" }}>
        <button onClick={v.setMonthly} aria-pressed={v.mSel} style={{ minHeight: "44px", padding: "0 18px", borderRadius: "11px", border: "0", background: v.billA.bg, color: v.billA.fg, fontWeight: "800", fontSize: "14px", cursor: "pointer" }}>Mensal</button>
        <button onClick={v.setYearly} aria-pressed={v.ySel} style={{ minHeight: "44px", padding: "0 18px", borderRadius: "11px", border: "0", background: v.billB.bg, color: v.billB.fg, fontWeight: "800", fontSize: "14px", cursor: "pointer" }}>Anual · 2 meses grátis</button>
      </div>
      <div className="g3" style={{ width: "100%", alignItems: "stretch" }}>
        {(v.plans || []).map((p: any, __i4: number) => (<Fragment key={__i4}>
          <div className="card-lift" style={{ position: "relative", borderRadius: "26px", padding: "26px", display: "flex", flexDirection: "column", gap: "14px", background: p.bg, color: p.fg, border: `1px solid ${p.border}` }}>
            {!!(p.badge) && (<>
              <span style={{ position: "absolute", top: "-13px", left: "26px", fontSize: "12px", fontWeight: "800", background: "#5FD4C1", color: "#0A3D35", borderRadius: "999px", padding: "4px 12px" }}>Mais escolhido</span>
            </>)}
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "800" }}>{p.name}</span>
            <span style={{ fontSize: "14.5px", opacity: "0.85" }}>{p.desc}</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "46px", fontWeight: "800", letterSpacing: "-0.03em", lineHeight: "1", fontVariantNumeric: "tabular-nums" }}>{p.price}</span><span style={{ fontSize: "14px", fontWeight: "700", opacity: "0.8" }}>{p.per}</span></span>
            <span style={{ fontSize: "13px", opacity: "0.75", minHeight: "20px" }}>{p.note}</span>
            {!!(p.isCom) && (<>
              <div role="group" aria-label="Número de contratos" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "4px", background: "#E4EFEC", borderRadius: "12px", padding: "4px" }}>
                {(v.tiers || []).map((t: any, __i8: number) => (<Fragment key={__i8}>
                  <button onClick={t.go} aria-pressed={t.sel} style={{ minHeight: "44px", borderRadius: "9px", border: "0", background: t.bg, color: t.fg, fontWeight: "800", fontSize: "12.5px", cursor: "pointer", padding: "0 2px" }}>{t.label}</button>
                </Fragment>))}
              </div>
            </>)}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexGrow: "1" }}>
              {(p.items || []).map((it: any, __i7: number) => (<Fragment key={__i7}>
                <span style={{ display: "flex", gap: "8px", fontSize: "14.5px" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.check} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}><path d="M5 12l5 5L20 7"></path></svg>{it}</span>
              </Fragment>))}
            </div>
            <a href="/comecar" style={{ minHeight: "50px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "14px", background: p.btnBg, color: p.btnFg, fontWeight: "800", fontSize: "15px", textDecoration: "none" }}>{p.cta}</a>
          </div>
        </Fragment>))}
      </div>

      <div style={{ width: "100%", boxSizing: "border-box", borderRadius: "22px", background: "#D4F1E9", padding: "20px 24px", display: "flex", flexWrap: "wrap", gap: "14px 24px", alignItems: "center" }}>
        <span style={{ width: "44px", height: "44px", borderRadius: "14px", background: "#0A3D35", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5FD4C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5L12 4l9 6.5V20H3zM9 20v-6h6v6"></path></svg></span>
        <span style={{ display: "flex", flexDirection: "column", flexGrow: "1", minWidth: "220px" }}><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "20px", fontWeight: "800" }}>Casas e empresas? Pro + Comercial com 20% de desconto.</span><span style={{ fontSize: "14.5px", color: "#2F5B54" }}>{v.comboText}</span></span>
        <a href="/comecar" style={{ minHeight: "48px", boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 20px", borderRadius: "14px", background: "#0A3D35", color: "#FFFFFF", fontWeight: "800", fontSize: "15px", textDecoration: "none" }}>Testar o combo</a>
      </div>

      <div className="g4" style={{ width: "100%" }}>
        {(v.guarantees || []).map((g: any, __i4: number) => (<Fragment key={__i4}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "16px", borderRadius: "18px", border: "1px solid #DCEAE6", background: "#F7FBFA" }}>
            <span style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#FFFFFF", border: "1px solid #DCEAE6", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={g.icon}></path></svg></span>
            <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "800", fontSize: "15px" }}>{g.title}</span><span style={{ fontSize: "13.5px", color: "#4E7770" }}>{g.text}</span></span>
          </div>
        </Fragment>))}
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
        <span style={{ fontWeight: "800", fontSize: "15px" }}>Incluso em todos os planos</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {(v.included || []).map((x: any, __i5: number) => (<Fragment key={__i5}>
            <span style={{ fontSize: "13.5px", fontWeight: "700", color: "#2F5B54", background: "#F1F6F5", border: "1px solid #DCEAE6", borderRadius: "999px", padding: "6px 12px" }}>{x}</span>
          </Fragment>))}
        </div>
      </div>
      <span style={{ fontSize: "13px", color: "#4E7770", textAlign: "center" }}>Preços em dólar americano, mais impostos quando aplicáveis.</span>
    </div>
  </section>

  
  <section id="duvidas" style={{ paddingBlock: "88px" }}>
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "28px", maxWidth: "860px" }}>
      <h2 className="h2">Dúvidas frequentes</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {(v.faqs || []).map((q: any, __i4: number) => (<Fragment key={__i4}>
          <div style={{ background: "#FFFFFF", border: "1px solid #DCEAE6", borderRadius: "18px", overflow: "hidden" }}>
            <button onClick={q.toggle} aria-expanded={q.exp} style={{ width: "100%", minHeight: "60px", display: "flex", alignItems: "center", gap: "12px", padding: "0 20px", border: "0", background: "transparent", textAlign: "left", cursor: "pointer", color: "#0A3D35" }}>
              <span style={{ flexGrow: "1", fontWeight: "800", fontSize: "16.5px" }}>{q.q}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A3D35" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${q.rot}deg)`, transition: "transform .2s", flex: "none" }}><path d="M6 9l6 6 6-6"></path></svg>
            </button>
            {!!(q.open) && (<>
              <p style={{ margin: "0", padding: "0 20px 20px", fontSize: "15.5px", color: "#3E5A55", lineHeight: "1.6" }}>{q.a}</p>
            </>)}
          </div>
        </Fragment>))}
      </div>
      <span style={{ fontSize: "15px", color: "#3E5A55" }}>Ainda com dúvida? <button onClick={v.openChat} style={{ minHeight: "44px", border: "0", background: "transparent", color: "#0B7C6E", fontWeight: "800", fontSize: "15px", cursor: "pointer", padding: "0 4px", textDecoration: "underline" }}>Fale com uma pessoa</button></span>
    </div>
  </section>

  
  <section style={{ paddingBlock: "24px 80px" }}>
    <div className="wrap">
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "32px", background: "#D4F1E9", padding: "64px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", textAlign: "center" }}>
        <div className="float" aria-hidden="true" style={{ position: "absolute", left: "6%", top: "30px", width: "54px", height: "54px", borderRadius: "16px", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18v12H3zM3 10h18M7 15h3"></path></svg></div>
        <div className="float s2" aria-hidden="true" style={{ position: "absolute", right: "7%", bottom: "34px", width: "50px", height: "50px", borderRadius: "50px", background: "#0A3D35", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="#5FD4C1"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"></path></svg></div>
        <div className="float s3 hide-sm" aria-hidden="true" style={{ position: "absolute", right: "14%", top: "40px", width: "46px", height: "46px", borderRadius: "14px", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z"></path></svg></div>
        <svg width="96" height="96" viewBox="0 0 64 64" aria-hidden="true"><rect className="tidy-streak" x="13" y="51.5" width="38" height="2.4" rx="1.2" fill="#12A38F"></rect><g className="tidy-flip"><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F"></rect><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35"></rect><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round"></path></g></g></svg>
        <h2 className="h2" style={{ fontSize: "44px", maxWidth: "680px" }}>Deixe a bagunça com a gente. Você cuida do crescimento.</h2>
        <p style={{ margin: "0", fontSize: "17px", color: "#2F5B54", maxWidth: "540px" }}>14 dias grátis, sem cartão. Se quiser, a gente importa seus clientes e configura tudo numa chamada de 30 minutos.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
          <a href="/comecar" className="cta-primary" style={{ minHeight: "56px", boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 28px", borderRadius: "16px", background: "#0B7C6E", color: "#FFFFFF", fontWeight: "800", fontSize: "16.5px", textDecoration: "none" }}>Criar minha conta grátis</a>
          <button onClick={v.openPopup} style={{ minHeight: "56px", boxSizing: "border-box", padding: "0 22px", borderRadius: "16px", background: "#FFFFFF", border: "1px solid #B7D9CF", color: "#0A3D35", fontWeight: "800", fontSize: "16px", cursor: "pointer" }}>Agendar chamada grátis</button>
        </div>
      </div>
    </div>
  </section>

  <footer style={{ background: "#0A3D35", color: "#B9D6D0", paddingBlock: "44px 110px" }}>
    <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "28px", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "320px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="17" fill="#0A3D35"></rect><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#FFFFFF"></rect><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#FFFFFF"></rect><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round"></path></g></svg>
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-0.035em" }}>tidyo</span>
        </span>
        <span style={{ fontSize: "14px" }}>Gestão para empresas de limpeza residencial e comercial nos EUA.</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "18px 28px" }}>
        <a href="#recursos" style={{ color: "#EAF5F2", textDecoration: "none", fontWeight: "700", fontSize: "14px" }}>Recursos</a>
        <a href="#precos" style={{ color: "#EAF5F2", textDecoration: "none", fontWeight: "700", fontSize: "14px" }}>Preços</a>
        <a href="#duvidas" style={{ color: "#EAF5F2", textDecoration: "none", fontWeight: "700", fontSize: "14px" }}>Ajuda</a>
        <a href="/privacidade" style={{ color: "#EAF5F2", textDecoration: "none", fontWeight: "700", fontSize: "14px" }}>Privacidade</a>
        <a href="/termos" style={{ color: "#EAF5F2", textDecoration: "none", fontWeight: "700", fontSize: "14px" }}>Termos</a>
        <a href="/privacidade#s10" style={{ color: "#EAF5F2", textDecoration: "none", fontWeight: "700", fontSize: "14px" }}>Segurança</a>
        <a href="/entrar" style={{ color: "#5FD4C1", textDecoration: "none", fontWeight: "800", fontSize: "14px" }}>Entrar</a>
      </div>
    </div>
    <div className="wrap" style={{ marginTop: "28px", fontSize: "13px", color: "#8FB3AC" }}>© 2026 Tidyo. Todos os direitos reservados.</div>
  </footer>

  
  <div style={{ position: "fixed", right: "max(20px, env(safe-area-inset-right, 0px))", bottom: "max(20px, env(safe-area-inset-bottom, 0px))", zIndex: "40", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
    {!!(v.chat) && (<>
      <div role="dialog" aria-label="Fale com a gente" style={{ width: "min(340px, calc(100vw - 40px))", background: "#FFFFFF", border: "1px solid #DCEAE6", borderRadius: "22px", boxShadow: "0 24px 50px rgba(10,61,53,.22)", overflow: "hidden" }}>
        <div style={{ background: "#0A3D35", color: "#FFFFFF", padding: "16px 18px", display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ display: "flex", flexDirection: "column", flexGrow: "1" }}><span style={{ fontWeight: "800", fontSize: "16px" }}>Oi! Aqui é a equipe Tidyo.</span><span style={{ fontSize: "13px", color: "#B9D6D0", display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "8px", height: "8px", borderRadius: "8px", background: "#5FD4C1" }}></span>Pessoas de verdade · PT · EN · ES</span></span>
          <button onClick={v.closeChat} aria-label="Fechar" style={{ width: "44px", height: "44px", borderRadius: "12px", border: "0", background: "rgba(255,255,255,.08)", color: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
        </div>
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {(v.chatOptions || []).map((o: any, __i5: number) => (<Fragment key={__i5}>
            <a href={o.href} style={{ minHeight: "56px", boxSizing: "border-box", display: "flex", gap: "12px", alignItems: "center", padding: "10px 12px", borderRadius: "14px", border: "1px solid #DCEAE6", textDecoration: "none", color: "#0A3D35" }}>
              <span style={{ width: "36px", height: "36px", borderRadius: "11px", background: o.bg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={o.fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={o.icon}></path></svg></span>
              <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "800", fontSize: "14.5px" }}>{o.title}</span><span style={{ fontSize: "12.5px", color: "#4E7770" }}>{o.text}</span></span>
            </a>
          </Fragment>))}
        </div>
      </div>
    </>)}
    <button onClick={v.toggleChat} aria-label={v.chatLabel} aria-expanded={v.chatExp} style={{ minHeight: "56px", padding: "0 20px 0 16px", borderRadius: "56px", border: "0", background: "#0B7C6E", color: "#FFFFFF", fontWeight: "800", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", boxShadow: "0 14px 30px rgba(10,61,53,.30)" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"></path></svg>
      <span className="hide-sm">Dúvidas? Fale com a gente</span>
    </button>
  </div>

  
  {!!(v.popup) && (<>
    <div style={{ position: "fixed", inset: "0", zIndex: "50", background: "rgba(6,31,27,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="pop-title" style={{ position: "relative", width: "min(520px, 100%)", background: "#FFFFFF", borderRadius: "28px", overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,.3)" }}>
        <div style={{ background: "#D4F1E9", padding: "28px 28px 22px", display: "flex", flexDirection: "column", gap: "10px", position: "relative" }}>
          <button onClick={v.closePopup} aria-label="Fechar" style={{ position: "absolute", top: "12px", right: "12px", width: "44px", height: "44px", borderRadius: "12px", border: "0", background: "rgba(10,61,53,.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A3D35" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
          <span style={{ alignSelf: "flex-start", fontSize: "12px", fontWeight: "800", background: "#0A3D35", color: "#5FD4C1", borderRadius: "999px", padding: "4px 10px" }}>Grátis para novas contas</span>
          <span id="pop-title" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "30px", fontWeight: "800", lineHeight: "1.08", letterSpacing: "-0.02em", paddingRight: "40px" }}>A gente importa seus clientes e configura tudo com você.</span>
        </div>
        <div style={{ padding: "22px 28px 28px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {(v.popupItems || []).map((x: any, __i5: number) => (<Fragment key={__i5}>
            <span style={{ display: "flex", gap: "10px", fontSize: "15.5px", color: "#2F5B54" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B7C6E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "3px" }}><path d="M5 12l5 5L20 7"></path></svg>{x}</span>
          </Fragment>))}
          <a href="/comecar" className="cta-primary" style={{ marginTop: "6px", minHeight: "54px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "16px", background: "#0B7C6E", color: "#FFFFFF", fontWeight: "800", fontSize: "16px", textDecoration: "none" }}>Quero começar com ajuda</a>
          <button onClick={v.closePopup} style={{ minHeight: "44px", border: "0", background: "transparent", color: "#4E7770", fontWeight: "700", fontSize: "14.5px", cursor: "pointer" }}>Agora não, vou explorar sozinha</button>
        </div>
      </div>
    </div>
  </>)}
</div>
  );
}
