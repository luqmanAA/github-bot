import express from 'express';
import bodyParser from 'body-parser';
import 'dotenv/config';

import {addPRComment, verifySignature} from './services/repositoryService.js';
import {triggerDeployment, removeDeployedContainer} from './services/deploymentService.js';

const app = express();
const port = process.env.PORT || 3003;

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
    const payload = JSON.stringify(req.body);
    const signature = req.headers['x-hub-signature'];
    console.log(signature)

    if (!verifySignature(payload, signature)) {
        return res.status(400).send('Invalid signature');
    }

    const event = req.headers['x-github-event'];
    console.log(event)
    if (event === 'pull_request') {
        const action = req.body.action;
        console.log(action)
        const prNumber = req.body.number;
        const branchName = req.body.pull_request.head.ref;
        const repoName = req.body.repository.full_name;
        const forkName = req.body.pull_request.head.repo.full_name;
        const installationId = req.body.installation.id

        const repoUrl = `https://github.com/${repoName}.git`;
        const repoBranchName = `${repoName.replace('/', '_')}_${branchName.replace('/', '_')}`;
        console.log(repoBranchName)
        const imageName = repoBranchName.toLowerCase();
        const containerName = `${imageName}_pr_${prNumber}`.toLowerCase();
        const forkRepoUrl = `https://github.com/${forkName}.git`;

        if (action === 'opened' || action === 'reopened' || action === 'synchronize') {
            try {
                const preDeployMessage = 'The PR is currently being deployed...'
                await addPRComment(repoName, prNumber, preDeployMessage, installationId);

                const postDeployMessage = await triggerDeployment(repoUrl, branchName, prNumber, imageName, containerName, forkRepoUrl);
                await addPRComment(repoName, prNumber, postDeployMessage, installationId);
                
                console.log("Deployment completed and comment added!")
            } catch (error) {
                console.error('Error during deployment:', error);
            }
        }

        else if (action === 'closed') {
            try {
                const message = await removeDeployedContainer(containerName, imageName);
                await addPRComment(repoName, prNumber, message, installationId);
                console.log('Container removed and comment added')
            } catch (error) {
                console.error('Error during deployment:', error);
            }
        }
    }

    res.status(200).send('Event received');
});


app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
