import { exec } from 'child_process';
import { spawn } from 'child_process';
import { promisify  } from 'util';


const DEPLOYMENT_BASE_URL = process.env.DEPLOYMENT_BASE_URL
const containerPort = process.env.containerPort || 5000
const hostPort = process.env.hostPort || containerPort

const execPromise = promisify(exec);

function runCommand(command, args, cwd) {
    console.log(command)
    console.log(args)
    console.log(cwd)
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


export async function triggerDeployment(repoName, branchName) {
    const repoUrl = `https://github.com/${repoName}.git`;
    const imageName = `${repoName.replace('/', '_')}_${branchName}`.toLowerCase();

    console.log("before execution")

    try {
        console.log('Cloning repository...');
        runCommand('rm -rf repo && git clone', [repoUrl, 'repo'], '.');
        
        console.log('Checking out branch...');
        runCommand('git checkout', [branchName], 'repo');
        
        console.log('Building Docker image...');
        runCommand('docker build -t', [imageName, '.'], 'repo');
        
        console.log('Running Docker container...');
        runCommand('docker run -d --name', [imageName, `-p ${hostPort}:${containerPort}`, imageName]);

        // Return the URL of the deployed app
        return `${DEPLOYMENT_BASE_URL}:${hostPort}`;
    } catch (error) {
        console.error(`Error during Docker deployment: ${error}`);
        throw error;
    }

    // try {
    //     // Clone the repository
    //     await execPromise(`rm -rf clonedRepo && git clone ${repoUrl} clonedRepo`);
    //     console.log("cloned successfully")

    //     // Change directory and checkout the branch
    //     await execPromise(`git checkout ${branchName}`, { cwd: 'clonedRepo' });
    //     console.log("checked out successfully")

    //     // Build the Docker image
    //     await execPromise(`docker build -t ${imageName} .`, { cwd: 'clonedRepo' });
    //     console.log("image built successfully")

    //     // Run the Docker container
    //     await execPromise(`docker run -d --name ${imageName} -p ${hostPort}:${containerPort} ${imageName}`);
    //     console.log(`App running successfully ${DEPLOYMENT_BASE_URL}:${hostPort}`)

    //     // Return the URL of the deployed app
    //     return `${DEPLOYMENT_BASE_URL}:${hostPort}`;
    // } catch (error) {
    //     console.error(`Error during Docker deployment: ${error.message}`);
    //     throw error;
    // }

    // return new Promise((resolve, reject) => {
    //     exec(`rm -rf clonedRepo && git clone ${repoUrl} clonedRepo && cd clonedRepo && git checkout ${branchName} && docker build -t ${imageName} . && docker run -d --name ${imageName} -p 5000:5000 ${imageName}`, (error, stdout, stderr) => {
    //         console.log(error)
    //         if (error) {
    //             console.error(`Error during Docker deployment: ${error}`);
    //             return reject(error);
    //         }
    //         console.log(`Docker deployment output: ${stdout}`);
            
    //         const deploymentUrl = `${DEPLOYMENT_BASE_URL}:5000/${imageName}`;
    //         console.log(deploymentUrl);
    //         resolve(deploymentUrl);
    //     });
    //     console.log("Deployment done")
    // });
}
