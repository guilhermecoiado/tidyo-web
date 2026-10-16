// Termos de uso e Política de privacidade do Tidyo, em PT, EN e ES.
// Texto-base para revisão jurídica antes do lançamento comercial.
import type { Lang } from '../lib/i18n';

export type Block = { h: string; p?: string[]; list?: string[]; table?: [string, string][] };
export type Doc = { title: string; updated: string; summaryTitle: string; summary: string[]; sections: Block[] };

export const LEGAL_VERSION = '2026-10-16';

const privacy: Record<Lang, Doc> = {
  'pt-BR': {
    title: 'Política de privacidade',
    updated: 'Vigente desde 16 de outubro de 2026 · versão 1.0',
    summaryTitle: 'Resumo em 30 segundos',
    summary: [
      'Usamos os dados do seu cadastro para criar e manter sua conta e para falar com você.',
      'Os dados da sua empresa (clientes, equipe, fotos, valores) são seus. Nós só guardamos e processamos para prestar o serviço.',
      'Não vendemos seus dados e não guardamos número de cartão.',
      'Marketing por WhatsApp, SMS ou email só com sua autorização, e você pode sair quando quiser.',
      'Você pode corrigir seus dados, cancelar a assinatura e excluir a conta pelo próprio app.',
    ],
    sections: [
      { h: 'Quem somos', p: [
        'O Tidyo é uma plataforma de gestão para empresas de limpeza residencial e comercial nos Estados Unidos.',
        'Para os dados da sua conta de assinante, o Tidyo é o controlador. Para os dados que você cadastra sobre seus clientes e sua equipe, você é o controlador e o Tidyo atua como operador (service provider), tratando esses dados só para prestar o serviço a você.',
      ] },
      { h: 'Dados que coletamos', table: [
        ['Cadastro', 'Nome, sobrenome, telefone (WhatsApp), email, estado e cidade, idioma preferido. Informados por você.'],
        ['Perfil do negócio', 'Nome e endereço da empresa, modo de uso (residencial ou comercial), tamanho da equipe, origem do cadastro (UTM).'],
        ['Assinatura', 'Plano, período de teste, status e histórico da assinatura.'],
        ['Uso do app', 'Telas acessadas, cliques em anúncios e botões, dispositivo, navegador, endereço IP, data e hora.'],
        ['Localização', 'GPS no momento do check-in de uma visita ou registro de ponto, só quando você ou sua equipe permitem no aparelho.'],
        ['Notificações', 'Identificador do aparelho para enviar avisos (push), se você ativar.'],
      ], p: ['Não coletamos número completo de cartão, CVV, número de seguro social (SSN) nem documentos de identidade.'] },
      { h: 'Como usamos seus dados', table: [
        ['Criar a conta, autenticar o acesso e prestar o serviço', 'Execução de contrato'],
        ['Avisos de conta: senha, assinatura, segurança e mudanças no serviço', 'Execução de contrato'],
        ['Traduzir mensagens, checklists e avisos entre português, inglês e espanhol', 'Execução de contrato'],
        ['Calcular rotas e estimar distâncias entre endereços', 'Execução de contrato'],
        ['Mostrar conteúdos e ofertas dentro do app, por região, idioma, plano e modo de uso', 'Legítimo interesse'],
        ['Enviar marketing por WhatsApp, SMS e email', 'Consentimento'],
        ['Medir campanhas (UTM) e melhorar o produto', 'Legítimo interesse'],
        ['Prevenir fraude e cumprir obrigações legais e fiscais', 'Obrigação legal'],
      ] },
      { h: 'Comunicações e anúncios', p: [
        'Dentro do app você pode ver banners, cards, popups e telas de conteúdo patrocinado, sempre com o selo "Patrocinado" e a opção de fechar. Eles usam os dados do seu perfil (região, idioma, plano, modo de uso) para mostrar o que é mais relevante. Não repassamos seus dados de contato aos anunciantes.',
        'WhatsApp, SMS e email de marketing só são enviados se você marcar a autorização no cadastro. A autorização não é condição para usar o app. Para sair, responda STOP por SMS, use o link no rodapé do email ou peça pelo suporte no app. Podem incidir tarifas da sua operadora.',
        'Notificações push são opcionais e podem ser desligadas a qualquer momento no app ou no sistema do aparelho.',
      ] },
      { h: 'Com quem compartilhamos', p: [
        'Não vendemos nem compartilhamos seus dados pessoais para publicidade de terceiros, no sentido usado pela lei da Califórnia (CCPA/CPRA). Compartilhamos apenas com fornecedores que ajudam a operar o serviço, sob contrato e com o mínimo necessário:',
      ], list: [
        'Infraestrutura, banco de dados, autenticação e armazenamento de fotos: Supabase.',
        'Hospedagem do aplicativo: Netlify.',
        'Localização de endereços: U.S. Census Geocoder e OpenStreetMap (Nominatim). Tradução de mensagens: MyMemory (Translated). Navegação: o app de mapas que você escolher (Google Maps, Waze ou Apple Maps), aberto por você.',
        'Envio de emails e notificações: provedores de email e de push do navegador.',
        'Pagamentos online, quando forem ativados: processador de pagamentos (por exemplo, Stripe). O Tidyo não guarda dados de cartão.',
        'Autoridades, quando exigido por lei ou ordem judicial.',
      ] },
      { h: 'Dados que você cadastra sobre outras pessoas', p: [
        'Ao cadastrar clientes, helpers ou funcionários, você declara que tem autorização para isso e que vai informá-los sobre o uso dos dados. Esses dados podem incluir nomes, contatos, endereços dos imóveis, instruções de acesso, fotos dos serviços, horas trabalhadas e valores.',
        'Usamos esses dados apenas para executar as funções que você ativar. Pedidos de clientes ou funcionários seus sobre esses dados devem ser feitos a você; se chegarem até nós, encaminhamos.',
        'Fotos dos serviços: evite registrar pessoas, documentos ou objetos pessoais dos seus clientes. Elas ficam visíveis no portal do cliente.',
      ] },
      { h: 'Por quanto tempo guardamos', list: [
        'Conta ativa: enquanto a conta existir.',
        'Após excluir a conta: até 30 dias para você se arrepender e baixar seus dados; depois disso, apagamos.',
        'Registros fiscais e de cobrança: pelo prazo exigido em lei.',
        'Registros de acesso: 6 meses.',
        'Cópias de segurança: sobrescritas em até 35 dias.',
      ] },
      { h: 'Seus direitos', p: [
        'Pela LGPD (art. 18) e pelas leis estaduais de privacidade dos EUA, como a CCPA/CPRA, você pode: confirmar e acessar seus dados; corrigir dados incompletos ou errados; pedir a portabilidade em formato aberto; pedir a exclusão; revogar o consentimento de marketing; e exercer esses direitos sem ser discriminado.',
        'Faça o pedido pelo suporte no app (Ajuda › Fale com o suporte). Respondemos em até 15 dias (LGPD) ou 45 dias (CCPA) e podemos pedir uma confirmação de identidade antes de atender.',
      ] },
      { h: 'Cancelar assinatura e excluir conta', list: [
        'Cancelar a assinatura: em Mais › Conta e assinatura, sem precisar falar com ninguém. O acesso continua até o fim do período já pago.',
        'Excluir a conta: em Mais › Conta e assinatura. Remove o acesso de toda a sua equipe e dos portais de clientes, e apaga os dados após 30 dias.',
      ] },
      { h: 'Segurança', p: [
        'Usamos conexão criptografada (HTTPS/TLS), dados criptografados em repouso, separação dos dados de cada empresa por regras no banco de dados, controle de acesso por papel, verificação em duas etapas opcional e senhas guardadas apenas em formato irreversível. Em caso de incidente com risco relevante, avisamos você e as autoridades nos prazos da lei.',
      ] },
      { h: 'Transferência internacional', p: [
        'Seus dados podem ser armazenados e processados nos Estados Unidos e em outros países onde nossos fornecedores operam, com garantias contratuais de proteção compatíveis com a LGPD.',
      ] },
      { h: 'Cookies e armazenamento local', p: [
        'Usamos o armazenamento do navegador para manter você conectado, lembrar idioma e preferências, guardar dados para uso sem internet e medir de onde veio seu cadastro (parâmetros UTM). Não usamos cookies de anúncios de terceiros.',
      ] },
      { h: 'Menores de idade', p: ['O Tidyo é destinado a pessoas com 18 anos ou mais. Não coletamos conscientemente dados de menores. Se identificarmos uma conta assim, ela é excluída.'] },
      { h: 'Alterações nesta política', p: ['Quando houver mudanças relevantes, avisamos por notificação no app com pelo menos 15 dias de antecedência. A data da versão vigente fica no topo desta página.'] },
      { h: 'Contato', p: ['Para dúvidas ou pedidos sobre seus dados, fale com a gente pelo suporte no app (Ajuda › Fale com o suporte). Você também pode reclamar à ANPD (Brasil) ou à autoridade de proteção ao consumidor do seu estado nos EUA.'] },
    ],
  },
  en: {
    title: 'Privacy policy',
    updated: 'Effective October 16, 2026 · version 1.0',
    summaryTitle: 'The 30-second version',
    summary: [
      'We use your sign-up details to create and run your account and to talk to you.',
      'Your business data (clients, team, photos, prices) belongs to you. We only store and process it to provide the service.',
      'We don’t sell your data and we don’t store card numbers.',
      'Marketing by WhatsApp, text or email only with your permission, and you can opt out anytime.',
      'You can fix your data, cancel your plan and delete your account right in the app.',
    ],
    sections: [
      { h: 'Who we are', p: [
        'Tidyo is a management platform for residential and commercial cleaning businesses in the United States.',
        'For your subscriber account data, Tidyo is the controller. For the data you enter about your clients and team, you are the controller and Tidyo acts as your service provider, processing it only to provide the service to you.',
      ] },
      { h: 'Data we collect', table: [
        ['Sign-up', 'First and last name, phone (WhatsApp), email, state and city, preferred language. Provided by you.'],
        ['Business profile', 'Business name and address, how you work (residential or commercial), team size, where you came from (UTM).'],
        ['Subscription', 'Plan, trial period, subscription status and history.'],
        ['App usage', 'Screens viewed, ad and button clicks, device, browser, IP address, date and time.'],
        ['Location', 'GPS at the moment of a visit check-in or clock-in, only when you or your team allow it on the device.'],
        ['Notifications', 'Device identifier to send push notifications, if you turn them on.'],
      ], p: ['We don’t collect full card numbers, CVV, Social Security numbers or ID documents.'] },
      { h: 'How we use your data', table: [
        ['Create the account, sign you in and provide the service', 'Contract'],
        ['Account notices: password, subscription, security and service changes', 'Contract'],
        ['Translate messages, checklists and notices between Portuguese, English and Spanish', 'Contract'],
        ['Plan routes and estimate distances between addresses', 'Contract'],
        ['Show in-app content and offers by region, language, plan and mode', 'Legitimate interest'],
        ['Send marketing by WhatsApp, text and email', 'Consent'],
        ['Measure campaigns (UTM) and improve the product', 'Legitimate interest'],
        ['Prevent fraud and meet legal and tax obligations', 'Legal obligation'],
      ] },
      { h: 'Communications and ads', p: [
        'Inside the app you may see banners, cards, popups and full-screen sponsored content, always labeled "Sponsored" with a way to close it. They use your profile (region, language, plan, mode) to show what’s most relevant. We don’t share your contact details with advertisers.',
        'Marketing by WhatsApp, text and email is only sent if you check the permission box at sign-up. It’s not a condition to use the app. To opt out, reply STOP by text, use the link at the bottom of the email or ask support in the app. Carrier rates may apply.',
        'Push notifications are optional and can be turned off anytime in the app or in your device settings.',
      ] },
      { h: 'Who we share with', p: [
        'We don’t sell or share your personal information for cross-context behavioral advertising, as defined by California law (CCPA/CPRA). We share only with vendors that help run the service, under contract and with the minimum needed:',
      ], list: [
        'Infrastructure, database, authentication and photo storage: Supabase.',
        'App hosting: Netlify.',
        'Address geocoding: U.S. Census Geocoder and OpenStreetMap (Nominatim). Message translation: MyMemory (Translated). Navigation: the maps app you choose (Google Maps, Waze or Apple Maps), opened by you.',
        'Email and notification delivery: email and browser push providers.',
        'Online payments, once enabled: a payment processor (for example, Stripe). Tidyo does not store card data.',
        'Authorities, when required by law or court order.',
      ] },
      { h: 'Data you enter about other people', p: [
        'When you add clients, helpers or employees, you confirm you’re allowed to and that you’ll tell them how their data is used. This may include names, contacts, property addresses, access instructions, job photos, hours worked and amounts.',
        'We use this data only to run the features you turn on. Requests from your clients or employees about this data should go to you; if they reach us, we forward them.',
        'Job photos: avoid capturing people, documents or personal items of your clients. Photos are visible in the client portal.',
      ] },
      { h: 'How long we keep data', list: [
        'Active account: as long as the account exists.',
        'After you delete your account: up to 30 days so you can change your mind and download your data; then we delete it.',
        'Tax and billing records: as long as the law requires.',
        'Access logs: 6 months.',
        'Backups: overwritten within 35 days.',
      ] },
      { h: 'Your rights', p: [
        'Under Brazil’s LGPD and US state privacy laws such as the CCPA/CPRA, you can: confirm and access your data; correct incomplete or wrong data; get a copy in an open format; ask us to delete it; withdraw marketing consent; and exercise these rights without being treated differently.',
        'Send your request through support in the app (Help › Talk to support). We reply within 15 days (LGPD) or 45 days (CCPA) and may ask you to confirm your identity first.',
      ] },
      { h: 'Cancel your plan and delete your account', list: [
        'Cancel your plan: in More › Account and plan, no calls needed. Access continues until the end of the paid period.',
        'Delete your account: in More › Account and plan. It removes access for your whole team and client portals, and deletes the data after 30 days.',
      ] },
      { h: 'Security', p: [
        'We use encrypted connections (HTTPS/TLS), encryption at rest, separation of each business’s data by database rules, role-based access, optional two-step verification and passwords stored only as irreversible hashes. If an incident creates a meaningful risk, we notify you and the authorities within the legal deadlines.',
      ] },
      { h: 'International transfers', p: ['Your data may be stored and processed in the United States and other countries where our vendors operate, with contractual safeguards compatible with the LGPD.'] },
      { h: 'Cookies and local storage', p: ['We use browser storage to keep you signed in, remember your language and preferences, keep data for offline use and measure where your sign-up came from (UTM parameters). We don’t use third-party advertising cookies.'] },
      { h: 'Children', p: ['Tidyo is meant for people 18 and older. We don’t knowingly collect data from minors. If we find such an account, we delete it.'] },
      { h: 'Changes to this policy', p: ['When there are meaningful changes, we notify you in the app at least 15 days in advance. The current version date is at the top of this page.'] },
      { h: 'Contact', p: ['For questions or requests about your data, contact us through support in the app (Help › Talk to support). You can also complain to Brazil’s ANPD or to your state’s consumer protection authority in the US.'] },
    ],
  },
  es: {
    title: 'Política de privacidad',
    updated: 'Vigente desde el 16 de octubre de 2026 · versión 1.0',
    summaryTitle: 'Resumen en 30 segundos',
    summary: [
      'Usamos los datos de tu registro para crear y mantener tu cuenta y para hablar contigo.',
      'Los datos de tu empresa (clientes, equipo, fotos, precios) son tuyos. Solo los guardamos y procesamos para prestar el servicio.',
      'No vendemos tus datos y no guardamos números de tarjeta.',
      'Marketing por WhatsApp, SMS o correo solo con tu permiso, y puedes darte de baja cuando quieras.',
      'Puedes corregir tus datos, cancelar el plan y eliminar la cuenta desde la propia app.',
    ],
    sections: [
      { h: 'Quiénes somos', p: [
        'Tidyo es una plataforma de gestión para empresas de limpieza residencial y comercial en Estados Unidos.',
        'Para los datos de tu cuenta de suscriptor, Tidyo es el responsable. Para los datos que registras sobre tus clientes y tu equipo, tú eres el responsable y Tidyo actúa como encargado (service provider), tratándolos solo para prestarte el servicio.',
      ] },
      { h: 'Datos que recopilamos', table: [
        ['Registro', 'Nombre, apellido, teléfono (WhatsApp), correo, estado y ciudad, idioma preferido. Los proporcionas tú.'],
        ['Perfil del negocio', 'Nombre y dirección de la empresa, forma de trabajo (residencial o comercial), tamaño del equipo, origen del registro (UTM).'],
        ['Suscripción', 'Plan, periodo de prueba, estado e historial de la suscripción.'],
        ['Uso de la app', 'Pantallas vistas, clics en anuncios y botones, dispositivo, navegador, dirección IP, fecha y hora.'],
        ['Ubicación', 'GPS en el momento del check-in de una visita o del registro de horas, solo si tú o tu equipo lo permiten en el dispositivo.'],
        ['Notificaciones', 'Identificador del dispositivo para enviar avisos (push), si los activas.'],
      ], p: ['No recopilamos el número completo de tarjeta, CVV, número de seguro social (SSN) ni documentos de identidad.'] },
      { h: 'Cómo usamos tus datos', table: [
        ['Crear la cuenta, iniciar sesión y prestar el servicio', 'Contrato'],
        ['Avisos de cuenta: contraseña, suscripción, seguridad y cambios en el servicio', 'Contrato'],
        ['Traducir mensajes, checklists y avisos entre portugués, inglés y español', 'Contrato'],
        ['Calcular rutas y estimar distancias entre direcciones', 'Contrato'],
        ['Mostrar contenidos y ofertas en la app por región, idioma, plan y modo de uso', 'Interés legítimo'],
        ['Enviar marketing por WhatsApp, SMS y correo', 'Consentimiento'],
        ['Medir campañas (UTM) y mejorar el producto', 'Interés legítimo'],
        ['Prevenir fraudes y cumplir obligaciones legales y fiscales', 'Obligación legal'],
      ] },
      { h: 'Comunicaciones y anuncios', p: [
        'Dentro de la app puedes ver banners, tarjetas, popups y pantallas de contenido patrocinado, siempre con la etiqueta "Patrocinado" y la opción de cerrar. Usan los datos de tu perfil (región, idioma, plan, modo de uso) para mostrar lo más relevante. No compartimos tus datos de contacto con los anunciantes.',
        'El marketing por WhatsApp, SMS y correo solo se envía si marcas el permiso al registrarte. No es condición para usar la app. Para darte de baja, responde STOP por SMS, usa el enlace al pie del correo o pídelo al soporte en la app. Pueden aplicarse tarifas de tu operador.',
        'Las notificaciones push son opcionales y puedes desactivarlas en cualquier momento en la app o en el sistema del dispositivo.',
      ] },
      { h: 'Con quién compartimos', p: [
        'No vendemos ni compartimos tus datos personales para publicidad de terceros, en el sentido de la ley de California (CCPA/CPRA). Solo compartimos con proveedores que ayudan a operar el servicio, bajo contrato y con lo mínimo necesario:',
      ], list: [
        'Infraestructura, base de datos, autenticación y almacenamiento de fotos: Supabase.',
        'Alojamiento de la app: Netlify.',
        'Geolocalización de direcciones: U.S. Census Geocoder y OpenStreetMap (Nominatim). Traducción de mensajes: MyMemory (Translated). Navegación: la app de mapas que elijas (Google Maps, Waze o Apple Maps), abierta por ti.',
        'Envío de correos y notificaciones: proveedores de correo y de push del navegador.',
        'Pagos en línea, cuando se activen: un procesador de pagos (por ejemplo, Stripe). Tidyo no guarda datos de tarjeta.',
        'Autoridades, cuando lo exija la ley o una orden judicial.',
      ] },
      { h: 'Datos que registras sobre otras personas', p: [
        'Al registrar clientes, ayudantes o empleados, declaras que tienes autorización y que les informarás sobre el uso de sus datos. Pueden incluir nombres, contactos, direcciones de los inmuebles, instrucciones de acceso, fotos de los servicios, horas trabajadas y montos.',
        'Usamos estos datos solo para las funciones que actives. Las solicitudes de tus clientes o empleados sobre estos datos deben dirigirse a ti; si nos llegan, las reenviamos.',
        'Fotos de los servicios: evita fotografiar personas, documentos u objetos personales de tus clientes. Las fotos se ven en el portal del cliente.',
      ] },
      { h: 'Cuánto tiempo guardamos los datos', list: [
        'Cuenta activa: mientras la cuenta exista.',
        'Después de eliminar la cuenta: hasta 30 días para que te arrepientas y descargues tus datos; luego los borramos.',
        'Registros fiscales y de cobro: el plazo que exija la ley.',
        'Registros de acceso: 6 meses.',
        'Copias de seguridad: se sobrescriben en hasta 35 días.',
      ] },
      { h: 'Tus derechos', p: [
        'Según la LGPD de Brasil y las leyes estatales de privacidad de EE. UU., como la CCPA/CPRA, puedes: confirmar y acceder a tus datos; corregir datos incompletos o erróneos; obtener una copia en formato abierto; pedir su eliminación; retirar el consentimiento de marketing; y ejercer estos derechos sin ser discriminado.',
        'Haz tu solicitud por el soporte en la app (Ayuda › Habla con soporte). Respondemos en hasta 15 días (LGPD) o 45 días (CCPA) y podemos pedirte confirmar tu identidad.',
      ] },
      { h: 'Cancelar el plan y eliminar la cuenta', list: [
        'Cancelar el plan: en Más › Cuenta y plan, sin llamar a nadie. El acceso sigue hasta el final del periodo pagado.',
        'Eliminar la cuenta: en Más › Cuenta y plan. Quita el acceso de todo tu equipo y de los portales de clientes, y borra los datos después de 30 días.',
      ] },
      { h: 'Seguridad', p: [
        'Usamos conexión cifrada (HTTPS/TLS), cifrado de datos almacenados, separación de los datos de cada empresa mediante reglas en la base de datos, acceso por rol, verificación en dos pasos opcional y contraseñas guardadas solo en formato irreversible. Si un incidente genera un riesgo relevante, te avisamos a ti y a las autoridades en los plazos legales.',
      ] },
      { h: 'Transferencia internacional', p: ['Tus datos pueden almacenarse y procesarse en Estados Unidos y en otros países donde operan nuestros proveedores, con garantías contractuales compatibles con la LGPD.'] },
      { h: 'Cookies y almacenamiento local', p: ['Usamos el almacenamiento del navegador para mantener tu sesión, recordar el idioma y tus preferencias, guardar datos para uso sin internet y medir de dónde vino tu registro (parámetros UTM). No usamos cookies publicitarias de terceros.'] },
      { h: 'Menores de edad', p: ['Tidyo está destinado a personas de 18 años o más. No recopilamos a sabiendas datos de menores. Si identificamos una cuenta así, la eliminamos.'] },
      { h: 'Cambios en esta política', p: ['Cuando haya cambios relevantes, te avisamos en la app con al menos 15 días de anticipación. La fecha de la versión vigente está al inicio de esta página.'] },
      { h: 'Contacto', p: ['Para dudas o solicitudes sobre tus datos, escríbenos por el soporte en la app (Ayuda › Habla con soporte). También puedes reclamar ante la ANPD (Brasil) o la autoridad de protección al consumidor de tu estado en EE. UU.'] },
    ],
  },
};

const terms: Record<Lang, Doc> = {
  'pt-BR': {
    title: 'Termos de uso',
    updated: 'Vigente desde 16 de outubro de 2026 · versão 1.0',
    summaryTitle: 'O essencial',
    summary: [
      'O Tidyo é um software por assinatura para organizar empresas de limpeza. Você continua responsável pelo seu negócio, sua equipe e seus clientes.',
      'O teste é de 14 dias, sem cartão. Você pode trocar de plano ou cancelar pelo próprio app.',
      'Seus dados são seus. Você pode baixá-los e excluir a conta quando quiser.',
      'Rotas, estimativas de preço, traduções e previsões financeiras são ajuda, não garantia: confira antes de decidir.',
    ],
    sections: [
      { h: 'Aceite', p: ['Ao criar uma conta ou usar o Tidyo, você concorda com estes termos e com a Política de privacidade. Se usar em nome de uma empresa, declara que pode representá-la. É preciso ter 18 anos ou mais.'] },
      { h: 'O serviço', p: ['O Tidyo oferece agenda, rotas, cadastro de clientes, contratos, checklist com fotos, controle de horas e pagamento da equipe, cobranças, finanças, portal do cliente, mensagens com tradução e o assistente Tidy. Funções podem ser adicionadas, alteradas ou retiradas para melhorar o produto; mudanças relevantes são avisadas com antecedência.'] },
      { h: 'Conta e acesso', list: [
        'Mantenha seus dados de cadastro corretos e sua senha em segurança. Recomendamos ativar a verificação em duas etapas.',
        'Você é responsável pelo que acontece na sua conta e pelos acessos que conceder à sua equipe e aos seus clientes.',
        'Avise o suporte se suspeitar de uso indevido.',
      ] },
      { h: 'Planos, teste e cobrança', list: [
        'Novas contas têm 14 dias de teste grátis, sem cartão.',
        'Os planos, preços e limites (como número de usuários, casas e contratos) aparecem em Mais › Conta e assinatura e podem mudar com aviso prévio de 30 dias.',
        'Quando a cobrança online estiver ativa, a assinatura é renovada automaticamente no fim de cada período até ser cancelada.',
        'Você pode cancelar a qualquer momento pelo app; o acesso continua até o fim do período já pago. Não há reembolso proporcional, salvo quando a lei exigir.',
        'Se um limite do plano for atingido, alguns cadastros novos ficam bloqueados até você trocar de plano.',
      ] },
      { h: 'Seus dados e os dos seus clientes', p: [
        'Tudo o que você cadastra continua sendo seu. Você nos autoriza a guardar e processar esses dados só para prestar o serviço, conforme a Política de privacidade.',
        'Você declara ter autorização para cadastrar dados de clientes e da equipe, inclusive fotos e localização no check-in, e se compromete a informá-los sobre esse uso.',
      ] },
      { h: 'Uso aceitável', list: [
        'Não use o Tidyo para atividades ilegais, spam, assédio ou para enviar mensagens a quem não autorizou recebê-las.',
        'Não tente acessar dados de outras empresas, burlar limites, sobrecarregar ou copiar o sistema.',
        'Respeite as leis trabalhistas, fiscais e de proteção ao consumidor que se aplicam ao seu negócio.',
      ] },
      { h: 'Ferramentas de apoio', p: [
        'Rotas e tempos de deslocamento são estimativas. Traduções são automáticas e podem ter erros; o original fica sempre disponível. Estimativas de preço, saúde financeira, previsões e relatórios ajudam na gestão, mas não substituem um contador ou advogado. Confira as informações antes de decidir.',
        'Cobranças e recebimentos registrados manualmente dependem dos dados que você informa. O Tidyo não movimenta dinheiro enquanto pagamentos online não estiverem ativos.',
      ] },
      { h: 'Anúncios', p: ['O app pode mostrar conteúdo patrocinado, sempre identificado e com opção de fechar. Ofertas de terceiros são de responsabilidade de quem as oferece.'] },
      { h: 'Disponibilidade', p: ['Trabalhamos para manter o Tidyo no ar o tempo todo, mas podem ocorrer pausas para manutenção ou falhas de fornecedores. O app guarda parte das ações no celular quando estiver sem internet e envia quando a conexão voltar.'] },
      { h: 'Propriedade intelectual', p: ['O software, a marca Tidyo e os conteúdos do app pertencem aos seus titulares. Você recebe uma licença de uso pessoal e intransferível enquanto a conta estiver ativa.'] },
      { h: 'Limitação de responsabilidade', p: ['Na extensão permitida em lei, o Tidyo não responde por lucros cessantes, perda de clientes ou danos indiretos, e a responsabilidade total fica limitada ao valor pago pela assinatura nos 12 meses anteriores ao evento.'] },
      { h: 'Suspensão e encerramento', p: ['Podemos suspender ou encerrar contas que violem estes termos, com aviso quando possível. Você pode excluir sua conta a qualquer momento em Mais › Conta e assinatura.'] },
      { h: 'Alterações', p: ['Podemos atualizar estes termos. Mudanças relevantes são avisadas no app com pelo menos 15 dias de antecedência. Continuar usando depois disso significa aceitar a nova versão.'] },
      { h: 'Contato', p: ['Dúvidas sobre estes termos: fale com o suporte no app (Ajuda › Fale com o suporte).'] },
    ],
  },
  en: {
    title: 'Terms of use',
    updated: 'Effective October 16, 2026 · version 1.0',
    summaryTitle: 'The essentials',
    summary: [
      'Tidyo is subscription software to run cleaning businesses. You remain responsible for your business, your team and your clients.',
      'The trial is 14 days, no card. You can change plans or cancel right in the app.',
      'Your data is yours. You can download it and delete your account anytime.',
      'Routes, price estimates, translations and financial forecasts are help, not guarantees: check before you decide.',
    ],
    sections: [
      { h: 'Acceptance', p: ['By creating an account or using Tidyo, you agree to these terms and to the Privacy policy. If you use it for a business, you confirm you can act on its behalf. You must be 18 or older.'] },
      { h: 'The service', p: ['Tidyo offers scheduling, routes, client records, contracts, checklists with photos, time tracking and team pay, invoicing, finances, a client portal, translated messaging and the Tidy assistant. Features may be added, changed or removed to improve the product; meaningful changes are announced in advance.'] },
      { h: 'Account and access', list: [
        'Keep your details accurate and your password safe. We recommend turning on two-step verification.',
        'You are responsible for activity in your account and for the access you give your team and clients.',
        'Tell support if you suspect misuse.',
      ] },
      { h: 'Plans, trial and billing', list: [
        'New accounts get a 14-day free trial, no card required.',
        'Plans, prices and limits (such as users, homes and contracts) are shown in More › Account and plan and may change with 30 days’ notice.',
        'Once online billing is live, subscriptions renew automatically at the end of each period until canceled.',
        'You can cancel anytime in the app; access continues until the end of the paid period. No prorated refunds unless required by law.',
        'If you reach a plan limit, some new records are blocked until you change plans.',
      ] },
      { h: 'Your data and your clients’ data', p: [
        'Everything you enter remains yours. You authorize us to store and process it only to provide the service, as described in the Privacy policy.',
        'You confirm you’re allowed to enter client and team data, including photos and check-in location, and that you’ll inform them about this use.',
      ] },
      { h: 'Acceptable use', list: [
        'Don’t use Tidyo for illegal activity, spam, harassment, or to message people who haven’t agreed to receive messages.',
        'Don’t try to access other businesses’ data, get around limits, overload or copy the system.',
        'Follow the labor, tax and consumer protection laws that apply to your business.',
      ] },
      { h: 'Helper tools', p: [
        'Routes and drive times are estimates. Translations are automatic and may contain errors; the original is always available. Price estimates, financial health, forecasts and reports help you manage, but don’t replace an accountant or lawyer. Check before you decide.',
        'Manually recorded invoices and payments depend on what you enter. Tidyo doesn’t move money while online payments are not live.',
      ] },
      { h: 'Ads', p: ['The app may show sponsored content, always labeled and closable. Third-party offers are the responsibility of whoever makes them.'] },
      { h: 'Availability', p: ['We work to keep Tidyo available at all times, but there may be maintenance pauses or vendor outages. The app saves some actions on the phone while offline and sends them when the connection returns.'] },
      { h: 'Intellectual property', p: ['The software, the Tidyo brand and app content belong to their owners. You get a personal, non-transferable license to use it while your account is active.'] },
      { h: 'Limitation of liability', p: ['To the extent allowed by law, Tidyo isn’t liable for lost profits, lost clients or indirect damages, and total liability is limited to what you paid for the subscription in the 12 months before the event.'] },
      { h: 'Suspension and termination', p: ['We may suspend or close accounts that break these terms, with notice when possible. You can delete your account anytime in More › Account and plan.'] },
      { h: 'Changes', p: ['We may update these terms. Meaningful changes are announced in the app at least 15 days in advance. Continuing to use Tidyo after that means you accept the new version.'] },
      { h: 'Contact', p: ['Questions about these terms: contact support in the app (Help › Talk to support).'] },
    ],
  },
  es: {
    title: 'Términos de uso',
    updated: 'Vigente desde el 16 de octubre de 2026 · versión 1.0',
    summaryTitle: 'Lo esencial',
    summary: [
      'Tidyo es un software por suscripción para organizar empresas de limpieza. Tú sigues siendo responsable de tu negocio, tu equipo y tus clientes.',
      'La prueba es de 14 días, sin tarjeta. Puedes cambiar de plan o cancelar desde la propia app.',
      'Tus datos son tuyos. Puedes descargarlos y eliminar la cuenta cuando quieras.',
      'Rutas, estimaciones de precio, traducciones y previsiones financieras son ayuda, no garantía: revísalas antes de decidir.',
    ],
    sections: [
      { h: 'Aceptación', p: ['Al crear una cuenta o usar Tidyo, aceptas estos términos y la Política de privacidad. Si lo usas en nombre de una empresa, declaras que puedes representarla. Debes tener 18 años o más.'] },
      { h: 'El servicio', p: ['Tidyo ofrece agenda, rutas, registro de clientes, contratos, checklist con fotos, control de horas y pago del equipo, cobros, finanzas, portal del cliente, mensajes con traducción y el asistente Tidy. Las funciones pueden añadirse, cambiarse o retirarse para mejorar el producto; los cambios relevantes se avisan con anticipación.'] },
      { h: 'Cuenta y acceso', list: [
        'Mantén tus datos correctos y tu contraseña segura. Recomendamos activar la verificación en dos pasos.',
        'Eres responsable de lo que ocurre en tu cuenta y de los accesos que das a tu equipo y a tus clientes.',
        'Avisa al soporte si sospechas de un uso indebido.',
      ] },
      { h: 'Planes, prueba y cobro', list: [
        'Las cuentas nuevas tienen 14 días de prueba gratis, sin tarjeta.',
        'Los planes, precios y límites (como usuarios, casas y contratos) aparecen en Más › Cuenta y plan y pueden cambiar con 30 días de aviso.',
        'Cuando el cobro en línea esté activo, la suscripción se renueva automáticamente al final de cada periodo hasta que la canceles.',
        'Puedes cancelar en cualquier momento desde la app; el acceso sigue hasta el final del periodo pagado. No hay reembolsos proporcionales, salvo cuando la ley lo exija.',
        'Si alcanzas un límite del plan, algunos registros nuevos se bloquean hasta que cambies de plan.',
      ] },
      { h: 'Tus datos y los de tus clientes', p: [
        'Todo lo que registras sigue siendo tuyo. Nos autorizas a guardarlo y procesarlo solo para prestar el servicio, según la Política de privacidad.',
        'Declaras tener autorización para registrar datos de clientes y del equipo, incluidas fotos y ubicación en el check-in, y te comprometes a informarles sobre este uso.',
      ] },
      { h: 'Uso aceptable', list: [
        'No uses Tidyo para actividades ilegales, spam, acoso ni para enviar mensajes a quien no aceptó recibirlos.',
        'No intentes acceder a datos de otras empresas, evadir límites, sobrecargar o copiar el sistema.',
        'Respeta las leyes laborales, fiscales y de protección al consumidor que aplican a tu negocio.',
      ] },
      { h: 'Herramientas de apoyo', p: [
        'Las rutas y tiempos de traslado son estimaciones. Las traducciones son automáticas y pueden tener errores; el original siempre está disponible. Las estimaciones de precio, la salud financiera, las previsiones y los informes ayudan a gestionar, pero no reemplazan a un contador o abogado. Revisa antes de decidir.',
        'Los cobros y pagos registrados manualmente dependen de los datos que ingresas. Tidyo no mueve dinero mientras los pagos en línea no estén activos.',
      ] },
      { h: 'Anuncios', p: ['La app puede mostrar contenido patrocinado, siempre identificado y con opción de cerrar. Las ofertas de terceros son responsabilidad de quien las ofrece.'] },
      { h: 'Disponibilidad', p: ['Trabajamos para mantener Tidyo disponible todo el tiempo, pero puede haber pausas por mantenimiento o fallas de proveedores. La app guarda parte de las acciones en el celular sin internet y las envía cuando vuelve la conexión.'] },
      { h: 'Propiedad intelectual', p: ['El software, la marca Tidyo y los contenidos de la app pertenecen a sus titulares. Recibes una licencia de uso personal e intransferible mientras la cuenta esté activa.'] },
      { h: 'Limitación de responsabilidad', p: ['En la medida que permita la ley, Tidyo no responde por lucro cesante, pérdida de clientes ni daños indirectos, y la responsabilidad total se limita a lo pagado por la suscripción en los 12 meses anteriores al hecho.'] },
      { h: 'Suspensión y cierre', p: ['Podemos suspender o cerrar cuentas que incumplan estos términos, con aviso cuando sea posible. Puedes eliminar tu cuenta en cualquier momento en Más › Cuenta y plan.'] },
      { h: 'Cambios', p: ['Podemos actualizar estos términos. Los cambios relevantes se avisan en la app con al menos 15 días de anticipación. Seguir usando Tidyo después significa aceptar la nueva versión.'] },
      { h: 'Contacto', p: ['Dudas sobre estos términos: escribe al soporte en la app (Ayuda › Habla con soporte).'] },
    ],
  },
};

export const LEGAL = { privacy, terms };
