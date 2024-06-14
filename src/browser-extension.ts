import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;


function xlog(...args: any[]) {
    args.forEach((arg) => {
        console.log(arg);

        if (typeof arg === 'string') {
            outputChannel.appendLine(arg);
        } else {
            outputChannel.appendLine(JSON.stringify(arg, null, 2));
        }
    });
}

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Remote Hosts');
    outputChannel.appendLine('Remote Hosts extension activate');
   
    if (!context.globalState.get("code-remote-machines.openInCodeRegistered")) {

        const opencode = vscode.commands.registerCommand('code-remote-machines.openInCode', () => {
            vscode.window.showInformationMessage('Trying to open in Visual Studio Code...');
        
            vscode.window.showInputBox({
                title: "Enter the token used to connect (normally ?tkn=... section of the URL when you opened this in the browser)",
                value: "supersecrettoken",
            }).then(( token ) => {
                const currentScheme = vscode.env.uriScheme;

                xlog("Current scheme is: ", currentScheme);

                let uriParts = `${currentScheme}://vscode-remote/code-remote-machines+${token}`;

                const currentHost = vscode.env.remoteName?.toString();
                uriParts += `@${currentHost}`;

                const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.path;
                if (workspaceFolder && workspaceFolder.length > 0) {
                    uriParts += workspaceFolder;
                } else {
                    uriParts += "/";
                }

                xlog("uriToOpen", uriParts);

                vscode.env.openExternal(vscode.Uri.parse(uriParts + "?windowId=_blank"));
            });
        });

        context.subscriptions.push(opencode);

        const opencodeins = vscode.commands.registerCommand('code-remote-machines.openInCodeInsiders', () => {
            vscode.window.showInformationMessage('Trying to open in Visual Studio Code...');
        
            vscode.window.showInputBox({
                title: "Enter the token used to connect (normally ?tkn=... section of the URL when you opened this in the browser)",
                value: "supersecrettoken",
            }).then(( token ) => {
                const currentScheme = vscode.env.uriScheme;

                xlog("Current scheme is: ", currentScheme);

                let uriParts = `vscode-insiders://vscode-remote/code-remote-machines+${token}`;

                const currentHost = vscode.env.remoteName?.toString();
                uriParts += `@${currentHost}`;

                const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.path;
                if (workspaceFolder && workspaceFolder.length > 0) {
                    uriParts += workspaceFolder;
                } else {
                    uriParts += "/";
                }

                xlog("uriToOpen", uriParts);

                vscode.env.openExternal(vscode.Uri.parse(uriParts + "?windowId=_blank"));
            });
        });
    
        context.subscriptions.push(opencodeins);
        context.globalState.update("code-remote-machines.openInCodeRegistered", true);
    }

}

export function deactivate() {}
