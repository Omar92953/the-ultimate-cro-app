/**
 * Loyalty → Languages: the program's words in the store's other languages (config.ts `LoyaltyLanguage`). The
 * storefront picks the language of the page (ucs-loyalty.js), emails the language of the customer's account
 * (`inLanguage`). The app's own translations of the default words (`BUILT_IN`) fill a new language in one click; a text
 * the store changed in its main language is left empty there, so it never gets a translation of the old default.
 */
import { DEFAULT_PAGE, WIDGET_TEXTS, type LoyaltyConfig, type LoyaltyLanguage, type WidgetTexts } from "./config";
import { DEFAULT_EMAIL_TEXTS, DEFAULT_EMAILS, EMAIL_KINDS, type EmailKind } from "./emails";

/** Languages a store can add (Shopify's codes). */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "ar", name: "Arabic" },
  { code: "bg", name: "Bulgarian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hr", name: "Croatian" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ms", name: "Malay" },
  { code: "nb", name: "Norwegian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "pt-br", name: "Portuguese (Brazil)" },
  { code: "pt-pt", name: "Portuguese (Portugal)" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sk", name: "Slovak" },
  { code: "sv", name: "Swedish" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "vi", name: "Vietnamese" },
  { code: "zh-cn", name: "Chinese (Simplified)" },
  { code: "zh-tw", name: "Chinese (Traditional)" },
];
export const languageName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();

type EmailWords = { subject: string; heading: string; body: string; button: string };
/** The app's translation of every default word, in the same order as the defaults (page items by place). */
type BuiltIn = {
  /** New widget texts without a translation yet stay empty (they use the main language's). */
  texts: Partial<WidgetTexts>;
  unit: { one: string; many: string };
  page: { title: string; sub: string; how: { t: string; x: string }[]; faq: { q: string; a: string }[] };
  /** The default rewards' titles: "10% off your order", "Free shipping". */
  rewards: Record<string, string>;
  emails: Record<EmailKind, EmailWords>;
  footer: string;
  unsubscribe: string;
};

const e = (subject: string, heading: string, body: string, button: string): EmailWords => ({ subject, heading, body, button });

export const BUILT_IN: Record<string, BuiltIn> = {
  fr: {
    texts: {
      launcher: "Récompenses", title: "Récompenses", guestTitle: "Inscrivez-vous et gagnez des récompenses", guestText: "Gagnez des points à chaque commande et échangez-les contre des récompenses.", join: "Créer un compte",
      tier: "Membre {tier}", nextTier: "{n} avant {tier}", birthdayWay: "Votre anniversaire", birthdayAsk: "Ajoutez votre anniversaire", birthdaySave: "Enregistrer", birthdayDone: "Anniversaire enregistré",
      followWay: "Suivez-nous sur {network}", reviewWay: "Écrire un avis produit", follow: "Suivre", campaign: "{x} points jusqu'au {date}", tierOnly: "Réservé aux membres {tiers}", signIn: "Se connecter",
      joinNow: "Rejoindre le programme", have: "Vous avez", pending: "{n} en attente", earn: "Comment gagner des points", rewards: "Récompenses", history: "Votre historique", get: "Obtenir", more: "Encore {n}",
      code: "Votre code", copy: "Copier", copied: "Copié", apply: "L'utiliser maintenant", applied: "Ajouté à votre panier", credit: "Ajouté à votre crédit en magasin. Il est utilisé au paiement.",
      product: "Gagnez {n} avec ce produit", cart: "Gagnez {n} avec cette commande", earned: "Vous avez gagné {n}", orderWay: "Chaque commande", signupWay: "Créer un compte", firstWay: "Votre première commande",
      error: "Une erreur s'est produite. Veuillez réessayer.", referTitle: "Parrainez un ami", referText: "Offrez {friend} à un ami sur sa première commande. Vous recevez {gift} quand il commande.", referLink: "Votre lien",
      shareText: "Voici {friend} pour ta première commande :", refBanner: "Un ami vous offre {friend}. Il est appliqué au paiement.", offPercent: "{x} % de réduction", offAmount: "{x} de réduction", freeShip: "la livraison gratuite",
      creditGift: "{x} de crédit en magasin", referWay: "Parrainer un ami", email: "E-mail", shopTitle: "Boutique de points", shopGet: "L'obtenir pour {price}", shopSignIn: "Connectez-vous pour l'obtenir avec vos points", shopMore: "Encore {n} pour l'obtenir", shopHave: "Vous avez {have} sur {n}",
    },
    unit: { one: "point", many: "points" },
    page: {
      title: "Récompenses", sub: "Gagnez des points à chaque commande et transformez-les en récompenses.",
      how: [{ t: "Inscrivez-vous", x: "Créez un compte pour commencer à gagner des points." }, { t: "Gagnez", x: "Recevez des points à chaque commande, et plus encore." }, { t: "Dépensez", x: "Transformez vos points en récompenses au paiement." }],
      faq: [
        { q: "Comment gagner des points ?", a: "Vous gagnez des points sur chaque commande payée, et plus encore pour tout ce qui figure dans Comment gagner des points." },
        { q: "Quand puis-je utiliser mes points ?", a: "Les points d'une commande sont utilisables dès que la commande ne peut plus être retournée." },
        { q: "Comment utiliser une récompense ?", a: "Ouvrez Récompenses, choisissez une récompense et utilisez le code au paiement. Le crédit en magasin est utilisé tout seul au paiement." },
      ],
    },
    rewards: { "10% off your order": "10 % de réduction sur votre commande", "Free shipping": "Livraison gratuite" },
    emails: {
      welcome: e("Bienvenue dans le programme de récompenses {store}", "Vous en faites partie", "Vous gagnez des {unit} à chaque commande et les échangez contre des récompenses. Votre solde : {balance}.", "Voir vos récompenses"),
      earned: e("Vous avez gagné {points}", "{points} pour la commande {order}", "Ils sont utilisables à partir du {date}. Votre solde : {balance}.", "Voir vos récompenses"),
      ready: e("Vous pouvez obtenir une récompense", "{balance} à dépenser", "C'est assez pour {reward}.", "Obtenir votre récompense"),
      reward: e("Votre récompense : {reward}", "{reward}", "Votre code est {code}. Utilisez-le au paiement avant le {date}.", "Acheter maintenant"),
      credit: e("{reward} ajouté à votre crédit en magasin", "{reward}", "Il est dans votre crédit en magasin et s'applique tout seul au paiement.", "Acheter maintenant"),
      tier: e("Vous avez atteint le niveau {tier}", "Bienvenue au niveau {tier}", "Votre nouveau niveau vous rapporte plus à chaque commande.", "Voir vos avantages"),
      tierDown: e("Votre niveau est maintenant {tier}", "Votre niveau est maintenant {tier}", "Commandez à nouveau pour remonter.", "Acheter maintenant"),
      referral: e("Votre ami a commandé", "Vous avez gagné {gift}", "Merci d'avoir partagé {store}. Votre solde : {balance}.", "Voir vos récompenses"),
      birthday: e("Joyeux anniversaire de la part de {store}", "Joyeux anniversaire", "Voici {points} pour fêter ça. Votre solde : {balance}.", "Faites-vous plaisir"),
      expiring: e("Vos {unit} expirent bientôt", "{balance} expirent le {date}", "Passez une commande ou obtenez une récompense d'ici là pour les garder.", "Les utiliser"),
      summary: e("Vos récompenses {store}", "Vous avez {balance}", "Dépensez-les en récompense lors de votre prochaine commande.", "Voir vos récompenses"),
    },
    footer: "Vous recevez cet e-mail en tant que membre du programme de récompenses {store}.",
    unsubscribe: "Se désabonner",
  },
  es: {
    texts: {
      launcher: "Recompensas", title: "Recompensas", guestTitle: "Únete y gana recompensas", guestText: "Gana puntos con cada pedido y cámbialos por recompensas.", join: "Crear una cuenta",
      tier: "Miembro {tier}", nextTier: "{n} para {tier}", birthdayWay: "Tu cumpleaños", birthdayAsk: "Añade tu cumpleaños", birthdaySave: "Guardar", birthdayDone: "Cumpleaños guardado",
      followWay: "Síguenos en {network}", reviewWay: "Escribe una reseña de producto", follow: "Seguir", campaign: "{x} puntos hasta el {date}", tierOnly: "Para miembros {tiers}", signIn: "Iniciar sesión",
      joinNow: "Unirse al programa", have: "Tienes", pending: "{n} en camino", earn: "Formas de ganar", rewards: "Recompensas", history: "Tu historial", get: "Obtener", more: "Te faltan {n}",
      code: "Tu código", copy: "Copiar", copied: "Copiado", apply: "Usarlo ahora", applied: "Añadido a tu carrito", credit: "Añadido a tu crédito de tienda. Se usa al pagar.",
      product: "Gana {n} con este producto", cart: "Gana {n} con este pedido", earned: "Has ganado {n}", orderWay: "Cada pedido", signupWay: "Crear una cuenta", firstWay: "Tu primer pedido",
      error: "Algo salió mal. Inténtalo de nuevo.", referTitle: "Recomienda a un amigo", referText: "Regala a un amigo {friend} en su primer pedido. Tú recibes {gift} cuando haga su pedido.", referLink: "Tu enlace",
      shareText: "Aquí tienes {friend} para tu primer pedido:", refBanner: "Un amigo te ha regalado {friend}. Se aplica al pagar.", offPercent: "{x}% de descuento", offAmount: "{x} de descuento", freeShip: "envío gratis",
      creditGift: "{x} en crédito de tienda", referWay: "Recomienda a un amigo", email: "Correo", shopTitle: "Compra con puntos", shopGet: "Consíguelo por {price}", shopSignIn: "Inicia sesión para conseguirlo con puntos", shopMore: "Te faltan {n} para conseguirlo", shopHave: "Tienes {have} de {n}",
    },
    unit: { one: "punto", many: "puntos" },
    page: {
      title: "Recompensas", sub: "Gana puntos con cada pedido y conviértelos en recompensas.",
      how: [{ t: "Únete", x: "Crea una cuenta para empezar a ganar." }, { t: "Gana", x: "Consigue puntos con cada pedido y más." }, { t: "Canjea", x: "Convierte tus puntos en recompensas al pagar." }],
      faq: [
        { q: "¿Cómo gano puntos?", a: "Ganas puntos con cada pedido pagado, y más por lo que aparece en Formas de ganar." },
        { q: "¿Cuándo puedo usar mis puntos?", a: "Los puntos de un pedido se pueden usar cuando el pedido ya no se puede devolver." },
        { q: "¿Cómo uso una recompensa?", a: "Abre Recompensas, elige una recompensa y usa el código al pagar. El crédito de tienda se usa solo al pagar." },
      ],
    },
    rewards: { "10% off your order": "10% de descuento en tu pedido", "Free shipping": "Envío gratis" },
    emails: {
      welcome: e("Bienvenido a las recompensas de {store}", "Ya eres miembro", "Ganas {unit} con cada pedido y los cambias por recompensas. Tu saldo: {balance}.", "Ver tus recompensas"),
      earned: e("Has ganado {points}", "{points} por el pedido {order}", "Puedes usarlos a partir del {date}. Tu saldo: {balance}.", "Ver tus recompensas"),
      ready: e("Ya puedes obtener una recompensa", "{balance} para gastar", "Es suficiente para {reward}.", "Obtener tu recompensa"),
      reward: e("Tu recompensa: {reward}", "{reward}", "Tu código es {code}. Úsalo al pagar antes del {date}.", "Comprar ahora"),
      credit: e("{reward} añadido a tu crédito de tienda", "{reward}", "Está en tu crédito de tienda y se usa solo al pagar.", "Comprar ahora"),
      tier: e("Has alcanzado {tier}", "Bienvenido a {tier}", "Tu nuevo nivel te da más con cada pedido.", "Ver tus ventajas"),
      tierDown: e("Tu nivel ahora es {tier}", "Tu nivel ahora es {tier}", "Vuelve a pedir para subir de nuevo.", "Comprar ahora"),
      referral: e("Tu amigo ha hecho un pedido", "Has ganado {gift}", "Gracias por compartir {store}. Tu saldo: {balance}.", "Ver tus recompensas"),
      birthday: e("Feliz cumpleaños de parte de {store}", "Feliz cumpleaños", "Aquí tienes {points} para celebrarlo. Tu saldo: {balance}.", "Date un capricho"),
      expiring: e("Tus {unit} caducan pronto", "{balance} caducan el {date}", "Haz un pedido o canjea una recompensa antes para conservarlos.", "Usarlos"),
      summary: e("Tus recompensas de {store}", "Tienes {balance}", "Cámbialos por una recompensa en tu próximo pedido.", "Ver tus recompensas"),
    },
    footer: "Recibes este correo como miembro de las recompensas de {store}.",
    unsubscribe: "Darse de baja",
  },
  de: {
    texts: {
      launcher: "Prämien", title: "Prämien", guestTitle: "Mitmachen und Prämien sichern", guestText: "Sammle bei jeder Bestellung Punkte und löse sie gegen Prämien ein.", join: "Konto erstellen",
      tier: "Mitglied {tier}", nextTier: "Noch {n} bis {tier}", birthdayWay: "Dein Geburtstag", birthdayAsk: "Geburtstag hinzufügen", birthdaySave: "Speichern", birthdayDone: "Geburtstag gespeichert",
      followWay: "Folge uns auf {network}", reviewWay: "Eine Produktbewertung schreiben", follow: "Folgen", campaign: "{x} Punkte bis {date}", tierOnly: "Für {tiers} Mitglieder", signIn: "Anmelden",
      joinNow: "Am Programm teilnehmen", have: "Du hast", pending: "{n} unterwegs", earn: "So sammelst du Punkte", rewards: "Prämien", history: "Dein Verlauf", get: "Einlösen", more: "Noch {n}",
      code: "Dein Code", copy: "Kopieren", copied: "Kopiert", apply: "Jetzt verwenden", applied: "Zum Warenkorb hinzugefügt", credit: "Deinem Guthaben gutgeschrieben. Es wird an der Kasse verwendet.",
      product: "Sammle {n} mit diesem Produkt", cart: "Sammle {n} mit dieser Bestellung", earned: "Du hast {n} gesammelt", orderWay: "Jede Bestellung", signupWay: "Konto erstellen", firstWay: "Deine erste Bestellung",
      error: "Etwas ist schiefgelaufen. Bitte versuche es erneut.", referTitle: "Freunde werben", referText: "Schenke einem Freund {friend} auf seine erste Bestellung. Du bekommst {gift}, wenn er bestellt.", referLink: "Dein Link",
      shareText: "Hier ist {friend} für deine erste Bestellung:", refBanner: "Ein Freund schenkt dir {friend}. Es wird an der Kasse abgezogen.", offPercent: "{x} % Rabatt", offAmount: "{x} Rabatt", freeShip: "kostenloser Versand",
      creditGift: "{x} Guthaben", referWay: "Freunde werben", email: "E-Mail", shopTitle: "Mit Punkten einkaufen", shopGet: "Für {price} holen", shopSignIn: "Melde dich an, um es mit Punkten zu holen", shopMore: "Noch {n}, um es zu holen", shopHave: "Du hast {have} von {n}",
    },
    unit: { one: "Punkt", many: "Punkte" },
    page: {
      title: "Prämien", sub: "Sammle bei jeder Bestellung Punkte und mach sie zu Prämien.",
      how: [{ t: "Mitmachen", x: "Erstelle ein Konto, um Punkte zu sammeln." }, { t: "Sammeln", x: "Erhalte Punkte bei jeder Bestellung und mehr." }, { t: "Einlösen", x: "Löse deine Punkte an der Kasse gegen Prämien ein." }],
      faq: [
        { q: "Wie sammle ich Punkte?", a: "Du sammelst Punkte bei jeder bezahlten Bestellung und weitere für alles unter So sammelst du Punkte." },
        { q: "Wann kann ich meine Punkte nutzen?", a: "Punkte aus einer Bestellung kannst du nutzen, sobald die Bestellung nicht mehr zurückgegeben werden kann." },
        { q: "Wie löse ich eine Prämie ein?", a: "Öffne Prämien, wähle eine Prämie und nutze den Code an der Kasse. Guthaben wird an der Kasse von selbst verwendet." },
      ],
    },
    rewards: { "10% off your order": "10 % Rabatt auf deine Bestellung", "Free shipping": "Kostenloser Versand" },
    emails: {
      welcome: e("Willkommen bei den Prämien von {store}", "Du bist dabei", "Du sammelst bei jeder Bestellung {unit} und löst sie gegen Prämien ein. Dein Stand: {balance}.", "Deine Prämien ansehen"),
      earned: e("Du hast {points} gesammelt", "{points} für Bestellung {order}", "Du kannst sie ab dem {date} nutzen. Dein Stand: {balance}.", "Deine Prämien ansehen"),
      ready: e("Du kannst eine Prämie einlösen", "{balance} zum Einlösen", "Das reicht für {reward}.", "Prämie einlösen"),
      reward: e("Deine Prämie: {reward}", "{reward}", "Dein Code ist {code}. Nutze ihn an der Kasse vor dem {date}.", "Jetzt einkaufen"),
      credit: e("{reward} deinem Guthaben gutgeschrieben", "{reward}", "Es ist in deinem Guthaben und wird an der Kasse von selbst verwendet.", "Jetzt einkaufen"),
      tier: e("Du hast {tier} erreicht", "Willkommen bei {tier}", "Deine neue Stufe bringt dir bei jeder Bestellung mehr.", "Deine Vorteile ansehen"),
      tierDown: e("Deine Stufe ist jetzt {tier}", "Deine Stufe ist jetzt {tier}", "Bestelle wieder, um aufzusteigen.", "Jetzt einkaufen"),
      referral: e("Dein Freund hat bestellt", "Du hast {gift} erhalten", "Danke, dass du {store} weiterempfiehlst. Dein Stand: {balance}.", "Deine Prämien ansehen"),
      birthday: e("Alles Gute zum Geburtstag von {store}", "Alles Gute zum Geburtstag", "Hier sind {points} zum Feiern. Dein Stand: {balance}.", "Gönn dir was"),
      expiring: e("Deine {unit} verfallen bald", "{balance} verfallen am {date}", "Bestelle oder löse vorher eine Prämie ein, um sie zu behalten.", "Jetzt nutzen"),
      summary: e("Deine Prämien bei {store}", "Du hast {balance}", "Löse sie bei deiner nächsten Bestellung gegen eine Prämie ein.", "Deine Prämien ansehen"),
    },
    footer: "Du bekommst diese E-Mail als Mitglied der Prämien von {store}.",
    unsubscribe: "Abmelden",
  },
  it: {
    texts: {
      launcher: "Premi", title: "Premi", guestTitle: "Iscriviti e ottieni premi", guestText: "Guadagna punti con ogni ordine e usali per ottenere premi.", join: "Crea un account",
      tier: "Membro {tier}", nextTier: "{n} per {tier}", birthdayWay: "Il tuo compleanno", birthdayAsk: "Aggiungi il tuo compleanno", birthdaySave: "Salva", birthdayDone: "Compleanno salvato",
      followWay: "Seguici su {network}", reviewWay: "Scrivi una recensione", follow: "Segui", campaign: "{x} punti fino al {date}", tierOnly: "Per i membri {tiers}", signIn: "Accedi",
      joinNow: "Iscriviti al programma", have: "Hai", pending: "{n} in arrivo", earn: "Come guadagnare", rewards: "Premi", history: "La tua cronologia", get: "Ottieni", more: "Ancora {n}",
      code: "Il tuo codice", copy: "Copia", copied: "Copiato", apply: "Usalo ora", applied: "Aggiunto al carrello", credit: "Aggiunto al tuo credito negozio. Viene usato al pagamento.",
      product: "Guadagna {n} con questo prodotto", cart: "Guadagna {n} con questo ordine", earned: "Hai guadagnato {n}", orderWay: "Ogni ordine", signupWay: "Crea un account", firstWay: "Il tuo primo ordine",
      error: "Qualcosa è andato storto. Riprova.", referTitle: "Invita un amico", referText: "Regala a un amico {friend} sul suo primo ordine. Tu ricevi {gift} quando ordina.", referLink: "Il tuo link",
      shareText: "Ecco {friend} per il tuo primo ordine:", refBanner: "Un amico ti ha regalato {friend}. Viene applicato al pagamento.", offPercent: "{x}% di sconto", offAmount: "{x} di sconto", freeShip: "spedizione gratuita",
      creditGift: "{x} di credito negozio", referWay: "Invita un amico", email: "Email", shopTitle: "Acquista con i punti", shopGet: "Ottienilo per {price}", shopSignIn: "Accedi per ottenerlo con i punti", shopMore: "Ancora {n} per ottenerlo", shopHave: "Hai {have} su {n}",
    },
    unit: { one: "punto", many: "punti" },
    page: {
      title: "Premi", sub: "Guadagna punti con ogni ordine e trasformali in premi.",
      how: [{ t: "Iscriviti", x: "Crea un account per iniziare a guadagnare." }, { t: "Guadagna", x: "Ottieni punti con ogni ordine e non solo." }, { t: "Usa", x: "Trasforma i tuoi punti in premi al pagamento." }],
      faq: [
        { q: "Come guadagno punti?", a: "Guadagni punti con ogni ordine pagato, e altri ancora per quanto indicato in Come guadagnare." },
        { q: "Quando posso usare i miei punti?", a: "I punti di un ordine si possono usare quando l'ordine non può più essere reso." },
        { q: "Come uso un premio?", a: "Apri Premi, scegli un premio e usa il codice al pagamento. Il credito negozio viene usato da solo al pagamento." },
      ],
    },
    rewards: { "10% off your order": "10% di sconto sul tuo ordine", "Free shipping": "Spedizione gratuita" },
    emails: {
      welcome: e("Benvenuto nei premi di {store}", "Ci sei", "Guadagni {unit} con ogni ordine e li usi per ottenere premi. Il tuo saldo: {balance}.", "Vedi i tuoi premi"),
      earned: e("Hai guadagnato {points}", "{points} per l'ordine {order}", "Puoi usarli dal {date}. Il tuo saldo: {balance}.", "Vedi i tuoi premi"),
      ready: e("Puoi ottenere un premio", "{balance} da spendere", "Bastano per {reward}.", "Ottieni il tuo premio"),
      reward: e("Il tuo premio: {reward}", "{reward}", "Il tuo codice è {code}. Usalo al pagamento entro il {date}.", "Acquista ora"),
      credit: e("{reward} aggiunto al tuo credito negozio", "{reward}", "È nel tuo credito negozio e viene usato da solo al pagamento.", "Acquista ora"),
      tier: e("Hai raggiunto {tier}", "Benvenuto in {tier}", "Il tuo nuovo livello ti dà di più a ogni ordine.", "Vedi i tuoi vantaggi"),
      tierDown: e("Il tuo livello ora è {tier}", "Il tuo livello ora è {tier}", "Ordina di nuovo per risalire.", "Acquista ora"),
      referral: e("Il tuo amico ha ordinato", "Hai guadagnato {gift}", "Grazie per aver condiviso {store}. Il tuo saldo: {balance}.", "Vedi i tuoi premi"),
      birthday: e("Buon compleanno da {store}", "Buon compleanno", "Ecco {points} per festeggiare. Il tuo saldo: {balance}.", "Concediti qualcosa"),
      expiring: e("I tuoi {unit} scadono presto", "{balance} scadono il {date}", "Fai un ordine o ottieni un premio prima di allora per tenerli.", "Usali"),
      summary: e("I tuoi premi {store}", "Hai {balance}", "Usali per un premio al tuo prossimo ordine.", "Vedi i tuoi premi"),
    },
    footer: "Ricevi questa email come membro dei premi di {store}.",
    unsubscribe: "Annulla iscrizione",
  },
  "pt-br": {
    texts: {
      launcher: "Recompensas", title: "Recompensas", guestTitle: "Participe e ganhe recompensas", guestText: "Ganhe pontos em cada pedido e troque por recompensas.", join: "Criar uma conta",
      tier: "Membro {tier}", nextTier: "{n} para {tier}", birthdayWay: "Seu aniversário", birthdayAsk: "Adicione seu aniversário", birthdaySave: "Salvar", birthdayDone: "Aniversário salvo",
      followWay: "Siga a gente no {network}", reviewWay: "Escreva uma avaliação de produto", follow: "Seguir", campaign: "{x} pontos até {date}", tierOnly: "Para membros {tiers}", signIn: "Entrar",
      joinNow: "Participar do programa", have: "Você tem", pending: "{n} a caminho", earn: "Como ganhar", rewards: "Recompensas", history: "Seu histórico", get: "Resgatar", more: "Faltam {n}",
      code: "Seu código", copy: "Copiar", copied: "Copiado", apply: "Usar agora", applied: "Adicionado ao carrinho", credit: "Adicionado ao seu crédito na loja. Ele é usado ao finalizar a compra.",
      product: "Ganhe {n} com este produto", cart: "Ganhe {n} com este pedido", earned: "Você ganhou {n}", orderWay: "Cada pedido", signupWay: "Criar uma conta", firstWay: "Seu primeiro pedido",
      error: "Algo deu errado. Tente de novo.", referTitle: "Indique um amigo", referText: "Dê {friend} a um amigo no primeiro pedido dele. Você ganha {gift} quando ele comprar.", referLink: "Seu link",
      shareText: "Aqui está {friend} para o seu primeiro pedido:", refBanner: "Um amigo deu {friend} para você. É aplicado ao finalizar a compra.", offPercent: "{x}% de desconto", offAmount: "{x} de desconto", freeShip: "frete grátis",
      creditGift: "{x} em crédito na loja", referWay: "Indique um amigo", email: "E-mail", shopTitle: "Compre com pontos", shopGet: "Resgate por {price}", shopSignIn: "Entre para resgatar com pontos", shopMore: "Faltam {n} para resgatar", shopHave: "Você tem {have} de {n}",
    },
    unit: { one: "ponto", many: "pontos" },
    page: {
      title: "Recompensas", sub: "Ganhe pontos em cada pedido e transforme em recompensas.",
      how: [{ t: "Participe", x: "Crie uma conta para começar a ganhar." }, { t: "Ganhe", x: "Receba pontos em cada pedido e muito mais." }, { t: "Resgate", x: "Troque seus pontos por recompensas ao finalizar a compra." }],
      faq: [
        { q: "Como ganho pontos?", a: "Você ganha pontos em cada pedido pago, e mais pelo que aparece em Como ganhar." },
        { q: "Quando posso usar meus pontos?", a: "Os pontos de um pedido podem ser usados quando o pedido não puder mais ser devolvido." },
        { q: "Como uso uma recompensa?", a: "Abra Recompensas, escolha uma recompensa e use o código ao finalizar a compra. O crédito na loja é usado sozinho ao finalizar a compra." },
      ],
    },
    rewards: { "10% off your order": "10% de desconto no seu pedido", "Free shipping": "Frete grátis" },
    emails: {
      welcome: e("Boas-vindas às recompensas da {store}", "Você está dentro", "Você ganha {unit} em cada pedido e troca por recompensas. Seu saldo: {balance}.", "Ver suas recompensas"),
      earned: e("Você ganhou {points}", "{points} pelo pedido {order}", "Você pode usá-los a partir de {date}. Seu saldo: {balance}.", "Ver suas recompensas"),
      ready: e("Você já pode resgatar uma recompensa", "{balance} para usar", "Isso dá para {reward}.", "Resgatar sua recompensa"),
      reward: e("Sua recompensa: {reward}", "{reward}", "Seu código é {code}. Use ao finalizar a compra antes de {date}.", "Comprar agora"),
      credit: e("{reward} adicionado ao seu crédito na loja", "{reward}", "Está no seu crédito na loja e é usado sozinho ao finalizar a compra.", "Comprar agora"),
      tier: e("Você chegou ao nível {tier}", "Boas-vindas ao {tier}", "Seu novo nível dá mais em cada pedido.", "Ver seus benefícios"),
      tierDown: e("Seu nível agora é {tier}", "Seu nível agora é {tier}", "Compre de novo para subir.", "Comprar agora"),
      referral: e("Seu amigo fez um pedido", "Você ganhou {gift}", "Obrigado por indicar a {store}. Seu saldo: {balance}.", "Ver suas recompensas"),
      birthday: e("Feliz aniversário da {store}", "Feliz aniversário", "Aqui estão {points} para comemorar. Seu saldo: {balance}.", "Aproveite"),
      expiring: e("Seus {unit} vencem em breve", "{balance} vencem em {date}", "Faça um pedido ou resgate uma recompensa antes disso para não perdê-los.", "Usar agora"),
      summary: e("Suas recompensas da {store}", "Você tem {balance}", "Troque por uma recompensa no seu próximo pedido.", "Ver suas recompensas"),
    },
    footer: "Você recebe este e-mail como membro das recompensas da {store}.",
    unsubscribe: "Cancelar inscrição",
  },
  nl: {
    texts: {
      launcher: "Beloningen", title: "Beloningen", guestTitle: "Doe mee en verdien beloningen", guestText: "Verdien punten bij elke bestelling en wissel ze in voor beloningen.", join: "Account aanmaken",
      tier: "Lid {tier}", nextTier: "Nog {n} tot {tier}", birthdayWay: "Je verjaardag", birthdayAsk: "Voeg je verjaardag toe", birthdaySave: "Opslaan", birthdayDone: "Verjaardag opgeslagen",
      followWay: "Volg ons op {network}", reviewWay: "Schrijf een productreview", follow: "Volgen", campaign: "{x} punten tot {date}", tierOnly: "Voor {tiers} leden", signIn: "Inloggen",
      joinNow: "Doe mee met het programma", have: "Je hebt", pending: "{n} onderweg", earn: "Zo verdien je punten", rewards: "Beloningen", history: "Je geschiedenis", get: "Inwisselen", more: "Nog {n}",
      code: "Je code", copy: "Kopiëren", copied: "Gekopieerd", apply: "Nu gebruiken", applied: "Toegevoegd aan je winkelwagen", credit: "Toegevoegd aan je winkeltegoed. Het wordt gebruikt bij het afrekenen.",
      product: "Verdien {n} met dit product", cart: "Verdien {n} met deze bestelling", earned: "Je hebt {n} verdiend", orderWay: "Elke bestelling", signupWay: "Account aanmaken", firstWay: "Je eerste bestelling",
      error: "Er ging iets mis. Probeer het opnieuw.", referTitle: "Nodig een vriend uit", referText: "Geef een vriend {friend} op de eerste bestelling. Jij krijgt {gift} als die bestelt.", referLink: "Je link",
      shareText: "Hier is {friend} voor je eerste bestelling:", refBanner: "Een vriend geeft je {friend}. Het wordt verrekend bij het afrekenen.", offPercent: "{x}% korting", offAmount: "{x} korting", freeShip: "gratis verzending",
      creditGift: "{x} winkeltegoed", referWay: "Nodig een vriend uit", email: "E-mail", shopTitle: "Winkelen met punten", shopGet: "Haal het voor {price}", shopSignIn: "Log in om het met punten te halen", shopMore: "Nog {n} om het te halen", shopHave: "Je hebt {have} van {n}",
    },
    unit: { one: "punt", many: "punten" },
    page: {
      title: "Beloningen", sub: "Verdien punten bij elke bestelling en maak er beloningen van.",
      how: [{ t: "Doe mee", x: "Maak een account aan om punten te verdienen." }, { t: "Verdien", x: "Krijg punten bij elke bestelling en meer." }, { t: "Wissel in", x: "Wissel je punten in voor beloningen bij het afrekenen." }],
      faq: [
        { q: "Hoe verdien ik punten?", a: "Je verdient punten bij elke betaalde bestelling, en meer voor alles onder Zo verdien je punten." },
        { q: "Wanneer kan ik mijn punten gebruiken?", a: "Punten van een bestelling kun je gebruiken zodra de bestelling niet meer kan worden geretourneerd." },
        { q: "Hoe gebruik ik een beloning?", a: "Open Beloningen, kies een beloning en gebruik de code bij het afrekenen. Winkeltegoed wordt vanzelf gebruikt bij het afrekenen." },
      ],
    },
    rewards: { "10% off your order": "10% korting op je bestelling", "Free shipping": "Gratis verzending" },
    emails: {
      welcome: e("Welkom bij de beloningen van {store}", "Je doet mee", "Je verdient {unit} bij elke bestelling en wisselt ze in voor beloningen. Je saldo: {balance}.", "Bekijk je beloningen"),
      earned: e("Je hebt {points} verdiend", "{points} voor bestelling {order}", "Je kunt ze gebruiken vanaf {date}. Je saldo: {balance}.", "Bekijk je beloningen"),
      ready: e("Je kunt een beloning krijgen", "{balance} om te besteden", "Dat is genoeg voor {reward}.", "Haal je beloning"),
      reward: e("Je beloning: {reward}", "{reward}", "Je code is {code}. Gebruik hem bij het afrekenen voor {date}.", "Nu shoppen"),
      credit: e("{reward} toegevoegd aan je winkeltegoed", "{reward}", "Het staat op je winkeltegoed en wordt vanzelf gebruikt bij het afrekenen.", "Nu shoppen"),
      tier: e("Je hebt {tier} bereikt", "Welkom bij {tier}", "Je nieuwe niveau geeft je meer bij elke bestelling.", "Bekijk je voordelen"),
      tierDown: e("Je niveau is nu {tier}", "Je niveau is nu {tier}", "Bestel opnieuw om weer te stijgen.", "Nu shoppen"),
      referral: e("Je vriend heeft besteld", "Je hebt {gift} verdiend", "Bedankt voor het delen van {store}. Je saldo: {balance}.", "Bekijk je beloningen"),
      birthday: e("Gefeliciteerd namens {store}", "Gefeliciteerd met je verjaardag", "Hier is {points} om het te vieren. Je saldo: {balance}.", "Trakteer jezelf"),
      expiring: e("Je {unit} verlopen binnenkort", "{balance} verlopen op {date}", "Plaats een bestelling of haal een beloning voor die tijd om ze te houden.", "Gebruik ze"),
      summary: e("Je beloningen bij {store}", "Je hebt {balance}", "Besteed ze aan een beloning bij je volgende bestelling.", "Bekijk je beloningen"),
    },
    footer: "Je krijgt deze e-mail als lid van de beloningen van {store}.",
    unsubscribe: "Afmelden",
  },
  ar: {
    texts: {
      launcher: "المكافآت", title: "المكافآت", guestTitle: "انضم واربح مكافآت", guestText: "اربح نقاطًا مع كل طلب واستبدلها بمكافآت.", join: "أنشئ حسابًا",
      tier: "عضو {tier}", nextTier: "{n} للوصول إلى {tier}", birthdayWay: "عيد ميلادك", birthdayAsk: "أضف تاريخ ميلادك", birthdaySave: "حفظ", birthdayDone: "تم حفظ تاريخ الميلاد",
      followWay: "تابعنا على {network}", reviewWay: "اكتب تقييمًا لمنتج", follow: "متابعة", campaign: "{x} نقاط حتى {date}", tierOnly: "لأعضاء {tiers}", signIn: "تسجيل الدخول",
      joinNow: "انضم إلى البرنامج", have: "لديك", pending: "{n} في الطريق", earn: "طرق الربح", rewards: "المكافآت", history: "سجلك", get: "احصل عليها", more: "يتبقى {n}",
      code: "رمزك", copy: "نسخ", copied: "تم النسخ", apply: "استخدمه الآن", applied: "أضيف إلى سلتك", credit: "أضيف إلى رصيدك في المتجر. يُستخدم عند الدفع.",
      product: "اربح {n} مع هذا المنتج", cart: "اربح {n} مع هذا الطلب", earned: "ربحت {n}", orderWay: "كل طلب", signupWay: "إنشاء حساب", firstWay: "طلبك الأول",
      error: "حدث خطأ ما. يرجى المحاولة مرة أخرى.", referTitle: "ادعُ صديقًا", referText: "امنح صديقك {friend} على طلبه الأول، وتحصل أنت على {gift} عندما يطلب.", referLink: "رابطك",
      shareText: "إليك {friend} لطلبك الأول:", refBanner: "أهداك صديق {friend}. يُضاف عند الدفع.", offPercent: "خصم {x}%", offAmount: "خصم {x}", freeShip: "شحن مجاني",
      creditGift: "{x} رصيد في المتجر", referWay: "ادعُ صديقًا", email: "البريد الإلكتروني", shopTitle: "تسوّق بالنقاط", shopGet: "احصل عليه مقابل {price}", shopSignIn: "سجّل الدخول للحصول عليه بالنقاط", shopMore: "{n} أخرى للحصول عليه", shopHave: "لديك {have} من {n}",
    },
    unit: { one: "نقطة", many: "نقاط" },
    page: {
      title: "المكافآت", sub: "اربح نقاطًا مع كل طلب وحوّلها إلى مكافآت.",
      how: [{ t: "انضم", x: "أنشئ حسابًا لتبدأ بجمع النقاط." }, { t: "اربح", x: "احصل على نقاط مع كل طلب والمزيد." }, { t: "استبدل", x: "حوّل نقاطك إلى مكافآت عند الدفع." }],
      faq: [
        { q: "كيف أربح النقاط؟", a: "تربح نقاطًا مع كل طلب مدفوع، والمزيد مقابل ما يظهر في طرق الربح." },
        { q: "متى يمكنني استخدام نقاطي؟", a: "يمكن استخدام نقاط الطلب عندما يصبح الطلب غير قابل للإرجاع." },
        { q: "كيف أستخدم المكافأة؟", a: "افتح المكافآت، واختر مكافأة، واستخدم الرمز عند الدفع. يُستخدم رصيد المتجر تلقائيًا عند الدفع." },
      ],
    },
    rewards: { "10% off your order": "خصم 10% على طلبك", "Free shipping": "شحن مجاني" },
    emails: {
      welcome: e("مرحبًا بك في مكافآت {store}", "أنت معنا الآن", "تربح {unit} مع كل طلب وتستبدلها بمكافآت. رصيدك: {balance}.", "عرض مكافآتك"),
      earned: e("ربحت {points}", "{points} مقابل الطلب {order}", "يمكنك استخدامها بدءًا من {date}. رصيدك: {balance}.", "عرض مكافآتك"),
      ready: e("يمكنك الحصول على مكافأة", "{balance} جاهزة للاستخدام", "هذا يكفي للحصول على {reward}.", "احصل على مكافأتك"),
      reward: e("مكافأتك: {reward}", "{reward}", "رمزك هو {code}. استخدمه عند الدفع قبل {date}.", "تسوّق الآن"),
      credit: e("أضيف {reward} إلى رصيدك في المتجر", "{reward}", "إنه في رصيدك في المتجر ويُستخدم تلقائيًا عند الدفع.", "تسوّق الآن"),
      tier: e("وصلت إلى {tier}", "مرحبًا بك في {tier}", "مستواك الجديد يمنحك المزيد مع كل طلب.", "عرض مزاياك"),
      tierDown: e("مستواك الآن {tier}", "مستواك الآن {tier}", "اطلب مرة أخرى لتعود إلى المستوى الأعلى.", "تسوّق الآن"),
      referral: e("صديقك قام بطلب", "ربحت {gift}", "شكرًا لمشاركتك {store}. رصيدك: {balance}.", "عرض مكافآتك"),
      birthday: e("عيد ميلاد سعيد من {store}", "عيد ميلاد سعيد", "إليك {points} احتفالًا بهذه المناسبة. رصيدك: {balance}.", "دلّل نفسك"),
      expiring: e("{unit} الخاصة بك تنتهي قريبًا", "{balance} تنتهي في {date}", "اطلب أو احصل على مكافأة قبل ذلك للاحتفاظ بها.", "استخدمها"),
      summary: e("مكافآتك في {store}", "لديك {balance}", "استبدلها بمكافأة في طلبك القادم.", "عرض مكافآتك"),
    },
    footer: "تصلك هذه الرسالة لأنك عضو في مكافآت {store}.",
    unsubscribe: "إلغاء الاشتراك",
  },
};

/** An empty language: every text uses the main language's. */
export const emptyLanguage = (code: string): LoyaltyLanguage => ({ code, texts: {}, unit: { one: "", many: "" }, page: { title: "", sub: "", how: [], faq: [] }, rewards: {}, emails: {}, footer: "", unsubscribe: "" });

/**
 * A new language filled with the app's translation where the store still uses the default words (a text it
 * changed stays empty: the translation would be of the old default). No translation: empty.
 */
export function prefill(c: LoyaltyConfig, code: string): LoyaltyLanguage {
  const b = BUILT_IN[code];
  const l = emptyLanguage(code);
  if (!b) return l;
  const keys = Object.keys(WIDGET_TEXTS) as (keyof typeof WIDGET_TEXTS)[];
  l.texts = Object.fromEntries(keys.filter((k) => c.widget.texts[k] === WIDGET_TEXTS[k] && b.texts[k]).map((k) => [k, b.texts[k]]));
  if (c.unit.one === "point" && c.unit.many === "points") l.unit = { ...b.unit };
  const pg = c.page;
  l.page = {
    title: pg.title === DEFAULT_PAGE.title ? b.page.title : "",
    sub: pg.sub === DEFAULT_PAGE.sub ? b.page.sub : "",
    how: pg.how.map((h, i) => ({ t: h.t === DEFAULT_PAGE.how[i]?.t ? b.page.how[i]?.t ?? "" : "", x: h.x === DEFAULT_PAGE.how[i]?.x ? b.page.how[i]?.x ?? "" : "" })),
    faq: pg.faq.map((f, i) => ({ q: f.q === DEFAULT_PAGE.faq[i]?.q ? b.page.faq[i]?.q ?? "" : "", a: f.a === DEFAULT_PAGE.faq[i]?.a ? b.page.faq[i]?.a ?? "" : "" })),
  };
  l.rewards = Object.fromEntries(c.rewards.filter((r) => b.rewards[r.title]).map((r) => [r.id, b.rewards[r.title]]));
  l.emails = Object.fromEntries(
    EMAIL_KINDS.map((k) => {
      const main = c.emails.texts[k], def = DEFAULT_EMAIL_TEXTS[k], tr = b.emails[k];
      return [k, { subject: main.subject === def.subject ? tr.subject : "", heading: main.heading === def.heading ? tr.heading : "", body: main.body === def.body ? tr.body : "", button: main.button === def.button ? tr.button : "" }] as const;
    }),
  );
  l.footer = c.emails.footer === DEFAULT_EMAILS.footer ? b.footer : "";
  l.unsubscribe = b.unsubscribe;
  return l;
}

/** The store's language for a customer or page language ("fr-CA" uses "fr", "pt-BR" uses "pt-br"), or none. */
export function languageFor(c: LoyaltyConfig, locale: string | null | undefined): LoyaltyLanguage | null {
  const code = String(locale ?? "").toLowerCase().replace("_", "-").trim();
  if (!code) return null;
  return c.languages.find((l) => l.code === code) ?? c.languages.find((l) => l.code.split("-")[0] === code.split("-")[0]) ?? null;
}

/** The program as a customer with this language sees it: the language's texts over the main ones. */
export function inLanguage(c: LoyaltyConfig, locale: string | null | undefined): LoyaltyConfig {
  const l = languageFor(c, locale);
  if (!l) return c;
  const or = (v: string | undefined, d: string) => (v ? v : d);
  return {
    ...c,
    unit: { one: or(l.unit.one, c.unit.one), many: or(l.unit.many, c.unit.many) },
    widget: { ...c.widget, texts: { ...c.widget.texts, ...l.texts } },
    page: {
      title: or(l.page.title, c.page.title),
      sub: or(l.page.sub, c.page.sub),
      how: c.page.how.map((h, i) => ({ t: or(l.page.how[i]?.t, h.t), x: or(l.page.how[i]?.x, h.x) })),
      faq: c.page.faq.map((f, i) => ({ q: or(l.page.faq[i]?.q, f.q), a: or(l.page.faq[i]?.a, f.a) })),
    },
    rewards: c.rewards.map((r) => ({ ...r, title: or(l.rewards[r.id], r.title) })),
    emails: {
      ...c.emails,
      footer: or(l.footer, c.emails.footer),
      unsubscribe: or(l.unsubscribe, c.emails.unsubscribe ?? ""),
      texts: Object.fromEntries(
        EMAIL_KINDS.map((k) => {
          const m = c.emails.texts[k], x = l.emails[k];
          return [k, { ...m, subject: or(x?.subject, m.subject), heading: or(x?.heading, m.heading), body: or(x?.body, m.body), button: or(x?.button, m.button) }];
        }),
      ) as typeof c.emails.texts,
    },
  };
}
