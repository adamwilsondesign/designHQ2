// Firebase predeploy hook. Refuses to deploy anything to the legacy DesignHQ
// project, which stays live as the fallback. Firebase sets GCLOUD_PROJECT for
// predeploy hooks.
const LEGACY_PROJECT_ID = 'gen-lang-client-0470160406';
const project = process.env.GCLOUD_PROJECT;

if (!project) {
  console.error('guard-deploy: GCLOUD_PROJECT is not set; refusing to deploy.');
  process.exit(1);
}
if (project === LEGACY_PROJECT_ID) {
  console.error(`guard-deploy: ${project} is the legacy DesignHQ project. The rebuild must deploy to its own project.`);
  process.exit(1);
}
console.log(`guard-deploy: deploying to ${project}`);
