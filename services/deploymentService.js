import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import ngrok from 'ngrok';


const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN

function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { cwd, stdio: 'pipe', shell: true });
        proc.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
        proc.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(`Process exited with code ${code}`);
            } else {
                resolve();
            }
        });
    });
}


export async function triggerDeployment(repoUrl, branchName, prNumber, imageName, containerName, forkRepoUrl) {
    const containerPort = process.env.containerPort || 5000
    const hostPort = 9000 + (prNumber % 1000);
    const folderName = imageName

    try {

        console.log('Checking if repository folder exists...');
        const folderExists = await fs.access(folderName).then(() => true).catch(() => false);

        if (folderExists) {
            console.log('Repository folder exists. Changing directory and checking out branch...');
            await runCommand(`cd ${folderName} && git fetch --all`);
            await runCommand(`cd ${folderName} && git branch -a`); // List all branches for debugging

            // Check if the branch exists locally
            try {
                await runCommand(`cd ${folderName} && git checkout ${branchName}`);
            } catch (error) {
                console.log(`Branch ${branchName} not found locally. Fetching from remote...`);
                if (forkRepoUrl !== repoUrl) {
                    await runCommand(`cd ${folderName} && git fetch ${forkRepoUrl} ${branchName}:${branchName}`);
                    await runCommand(`cd ${folderName} && git checkout ${branchName}`);
                } else {
                    throw new Error(`Branch ${branchName} not found and forkRepoUrl is not provided`);
                }
            }

            console.log('Pulling the remote branch for updates')
            await runCommand(`cd ${folderName} && git checkout ${branchName} && git pull origin ${branchName}`);

            } else {

            console.log('Repository folder does not exist. Cloning repository...');
            await runCommand(`git clone`, [repoUrl, `${folderName}`], '.');
            console.log('Checking out branch...');

            if (forkRepoUrl !== repoUrl) {
                    await runCommand(`cd ${folderName} && git fetch ${forkRepoUrl} ${branchName}:${branchName}`);
                    await runCommand(`cd ${folderName} && git checkout ${branchName}`);
                } else {
                    await runCommand('git checkout', [branchName], `${folderName}`);
                }
            }

        console.log('Building Docker image...');
        await runCommand('docker build -t', [imageName, '.'], `${folderName}`);

        console.log('Stopping and removing existing Docker container (if any)...');
        await runCommand('docker', ['rm', '-f', containerName]);
        
        console.log('Running Docker container...');
        await runCommand('docker run -d --name', [containerName, `-p ${hostPort}:${containerPort}`, imageName]);

        // build the URL of the deployed app and return as part of a message
        const deploymentLink = await getNgrokUrl(hostPort);
        return `Deployment completed! View it here: ${deploymentLink}`;

    } catch (error) {
        console.error(`Error during Docker deployment: ${error}`);
        throw error;
    }
}

export async function removeDeployedContainer(containerName, folderName) {

    try {
        console.log('Stopping and removing existing Docker container (if any)...');
        await runCommand('docker', ['rm', '-f', containerName]);

        console.log('Remove the associated folder\n')
        await runCommand(`rm -rf ${folderName}`);

        return "Contiainer successfully removed";
    } catch (error) {
        console.error(`Error while removing deployment resources: ${error}`);
        throw error;
    }
}


async function getNgrokUrl(port){
    try {
        const url = await ngrok.connect({
            proto: 'http',
            addr: port,
            authtoken: NGROK_AUTH_TOKEN
        });
        console.log(`ngrok tunnel started: ${url}`);
        return url;

    } catch (err) {
        console.error(`Error starting ngrok: ${err}`);
    }
}