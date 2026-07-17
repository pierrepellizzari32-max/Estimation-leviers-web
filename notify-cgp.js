// /api/notify-cgp.js
// Fonction serverless Vercel — reçoit le PDF récapitulatif interne généré
// côté client et l'envoie par email au CGP via Resend, EN PARALLÈLE du mail
// que le prospect envoie lui-même (mailto:). Le prospect ne voit jamais rien
// de cet appel : c'est un fetch() silencieux, best-effort.
//
// Variables d'environnement à définir dans Vercel (Project Settings > Environment Variables) :
//   RESEND_API_KEY   : ta clé API Resend
//   EMAIL_FROM       : adresse expéditrice vérifiée sur Resend
//   EMAIL_TO_CGP     : adresse de réception (toi) — défaut : pellizzari.p@hotmail.com
//
// Tant que RESEND_API_KEY n'est pas configurée, cette fonction répond une
// erreur 500 propre : le reste du simulateur continue de fonctionner
// normalement (l'appel est fait en "fire and forget" côté client).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée" });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@bilan-patrimoine.fr";
  const EMAIL_TO_CGP = process.env.EMAIL_TO_CGP || "pellizzari.p@hotmail.com";

  if (!RESEND_API_KEY) {
    res.status(500).json({ error: "RESEND_API_KEY non configurée sur Vercel" });
    return;
  }

  try {
    const { contact, pdf_base64, filename } = req.body || {};
    if (!pdf_base64) {
      res.status(400).json({ error: "pdf_base64 manquant" });
      return;
    }

    const nom = (contact && contact.name) || "Prospect";
    const email = (contact && contact.email) || "";
    const phone = (contact && contact.phone) || "";

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_TO_CGP],
        subject: "[Interne] Récap simulateur — " + nom,
        html:
          "<p>Nouvelle simulation avec demande de RDV.</p>" +
          "<p><b>Nom :</b> " + nom + "<br>" +
          "<b>Email :</b> " + email + "<br>" +
          "<b>Téléphone :</b> " + phone + "</p>" +
          "<p>Le détail complet (dispositifs réels + calculs) est en pièce jointe.</p>",
        attachments: [
          {
            filename: filename || "recap-interne.pdf",
            content: pdf_base64,
          },
        ],
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      res.status(502).json({ error: "Échec Resend", detail: errText });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", detail: String(err) });
  }
}