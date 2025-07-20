# 🚀 Déploiement

## Client (App)

Déployez sur [Vercel](https://vercel.com) :
1. Connectez votre repo GitHub
2. Cliquez "Deploy"

## Serveur (Optionnel)

Pour le multijoueur à distance :

1. Déployez le serveur sur [Render](https://render.com)
2. Mettez à jour `src/lib/remoteGameService.ts` avec votre URL
3. Redéployez le client

**Sans serveur** : L'app fonctionne en mode local automatiquement. 