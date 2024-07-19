import express from 'express';
import bodyParser from 'body-parser';
import 'dotenv/config';

import {addPRComment, verifySignature} from './services/repositoryService.js';
import {triggerDeployment} from './services/deploymentService.js';

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
        if (action === 'opened' || action === 'reopened') {
            const prNumber = req.body.number;
            const branchName = req.body.pull_request.head.ref;
            const repoName = req.body.repository.full_name;

            try {
                const deploymentLink = await triggerDeployment(repoName, branchName);
                await addPRComment(repoName, prNumber, deploymentLink);
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
