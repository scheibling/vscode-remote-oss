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

export function decode_remote_host(encoded: string, chan: vscode.OutputChannel): string | undefined {
    var match = encoded.match(/code-remote-machines\+(.*)/);
    if (match) {
        chan.appendLine(`decoded: ${match[0]} -> ${match[1]}`);
        
        return match[1];
    }
    chan.appendLine(`failed to decode: ${encoded}`);
    return undefined;
}

function makeResourceLabelFormatter(label: string): vscode.ResourceLabelFormatter {
    return {
        scheme: "vscode-remote",
        authority: "code-remote-machines+*",
        formatting: {
            label: "scheme:${scheme}:path:${path}:authority:${authority}:authoritySuffix:${authoritySuffix}",
            separator: "/",
            tildify: true,
            normalizeDriveLetter: true,
            stripPathStartingSeparator: true,
            workspaceSuffix: label,
            workspaceTooltip: "my first workspace tooltip",
        }
    };
}

async function resolveAuthority(
    label: string,
    channel: vscode.OutputChannel
): Promise<[ vscode.ResolvedAuthority, string, string ]> {
    channel.appendLine(`resolving label '${label}' ...`);

    // Split off the token component
    let splitTemp = label.split("@");
    if (splitTemp.length !== 2) {
        channel.appendLine(`invalid token format, should contain exactly one @: ${label}`);
        throw vscode.RemoteAuthorityResolverError.NotAvailable(`Invalid token format: ${label}`, true);
    }

    const remoteToken = splitTemp[0];
    channel.appendLine(`Found token: ${remoteToken}`);

    // Split off the host component
    splitTemp = splitTemp[1].split(":");
    if (splitTemp.length !== 2) {
        channel.appendLine(`invalid host format, should contain exactly one colon: ${label}`);
        throw vscode.RemoteAuthorityResolverError.NotAvailable(`Invalid host format: ${label}`, true);
    }

    const remoteHost = splitTemp[0];
    channel.appendLine(`Found host: ${remoteHost}`);

    splitTemp = splitTemp[1].split("/");

    const remotePort = parseInt(splitTemp[0]);
    channel.appendLine(`Found port: ${remotePort}`);

    const remoteFolder = splitTemp.slice(1).join("/");


    channel.appendLine(`Found folder: ${remoteFolder}`);
    channel.appendLine(`Connecting to ${remoteHost}:${remotePort} with token ${remoteToken} and folder ${remoteFolder}...`);

    if (remoteToken.length === 0) {
        return [ new vscode.ResolvedAuthority(remoteHost, remotePort), remoteFolder, remoteHost ];
    } else {
        return [ new vscode.ResolvedAuthority(remoteHost, remotePort, remoteToken), remoteFolder, remoteHost ];
    }
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
                let currentScheme = vscode.env.uriScheme;

                xlog("Current scheme is: ", currentScheme);

                if (currentScheme.endsWith("-server")) {
                    currentScheme = currentScheme.slice(0, -7);
                }

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







    async function doResolve(
        label: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>,
    ): Promise<vscode.ResolvedAuthority> {

        const [ authority, path, remoteHost ] = await resolveAuthority(label, outputChannel);

        context.subscriptions.push(vscode.workspace.registerResourceLabelFormatter(makeResourceLabelFormatter(remoteHost)));
        
        vscode.commands.executeCommand("setContext", "forwardedPortsViewEnabled", true);
        
        return authority;
    }

    const authorityResolverDisposable = vscode.workspace.registerRemoteAuthorityResolver('code-remote-machines', {
        async getCanonicalURI(uri: vscode.Uri): Promise<vscode.Uri> {
            return vscode.Uri.file(uri.path);
        },
        resolve(authority: string): Thenable<vscode.ResolvedAuthority> {
            outputChannel.appendLine(`resolving authority: ${authority}`);
            const host = decode_remote_host(authority, outputChannel);
            outputChannel.appendLine(`decoded host: ${host}`);
            if (host) {
                const noToken = host.split('@').slice(1).join('');
                return vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `connecting to ${noToken} ([details](command:code-remote-machines.showLog))`,
                    cancellable: false
                }, (progress) => doResolve(host, progress));
            }
            outputChannel.appendLine(`Failure decoding host`);
            throw vscode.RemoteAuthorityResolverError.NotAvailable('Invalid', true);
        },
    });
    context.subscriptions.push(authorityResolverDisposable);

    context.subscriptions.push(vscode.commands.registerCommand('code-remote-machines.showLog', () => {
        if (outputChannel) {
            outputChannel.show();
        }
    }));
}

export function deactivate() { }

