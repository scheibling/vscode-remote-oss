# remote-oss README

This extension allows you to use the existing remote extension host (REH) machinery of
VSCode for OSS builds. The machinery is the same as in the proprietary remote development
extension like `ms-vscode-remote.remote-ssh`. That is, it uses the same RPC protocol as VSCode
as it is part of the OSS release of VSCode.


The remote development pack provided by Microsoft includes several domain specific extensions
(ssh, docker, WSL2, etc.). These extensions contain shell scripts that are used to start up
a REH instance on the remote host. The remaining part is some glue code to direct the local editor
to a local port that has been forwarded in some way to the remote port or socket on which the REH
instance is listening. (And some fancy GUI of course...)

This extension delegates the REH startup and port forwarding completely to the user to keep the
scope simple. Therefore, if you want to use this extension then you are responsible for starting
up the **correct** version of the REH instance and creating the necessary tunnel to forward the
traffic (using for example SSH, see the examples below.) For now, this extension just allows you
to connect to a local port. (This is actually something the original remote extensions do not
allow you to do for some reason.)

**Note**: If you want an alternative that is limited to either SSH tunnels or WSL, you can try the extensions [open-remote-ssh](https://open-vsx.org/extension/jeanp413/open-remote-ssh) or [open-remote-wsl](https://open-vsx.org/extension/jeanp413/open-remote-wsl) instead.

## Requirements

VSCode defines the connection to remote hosts though special URIs of the shape:
```
    vscode-remote://<resolver>+<label><path>
```
In our case `<resolver>` is `remote-oss`, label is the name of the host defined in the settings
and `<path>` is the absolute path on the remote host.

In order to hook into this mechanism, this extension needs to enable several API proposals.
Normally these are blocked so you have to explicitly enable them in your `argv.json`. This
file is usually located in `~/.vscode-oss/argv.json` on Linux and you can  open by it by
running the `Preferences: Configure Runtime Arguments` command.


```json
{
    ...
    "enable-proposed-api": [
        ...,
        "xaberus.remote-oss"
    ],
    ...
}
```

With this out of the way, we can register our own "remote authority resolver" that will resolve
`vscode-remote://` URIs to whatever is configured in the corresponding settings section.

## Extension Settings

This extension contributes the following settings:

* `remote.OSS.hosts`: A list of remote hosts an their corresponding settings.

## Known Issues

The RPC protocol follows a strict versioning using the commit hash of the VSCode build as the version.
This is mostly useful, because different version might have incompatible changes. Unfortunately,
this also means that you have to upgrade the REH instance every time you upgrade your main editor.
If you are seeing "authentication" errors, the most probable reason is that your REH instance and
your editor have different versions.

## Quick Start

### Prerequirements
- You'll ned a remote host with a vscode-compatible server binary installed. This can be vscodium, code, code-server or equivalent. The example "vscodium-server over SSH tunnel" has a script for the installation of vscodium, but any of the variants should work. !This needs to be the same version as the desktop client you are running locally!
- You'll need to start the server on the remote host and note the connection token, either by setting it manually or letting it be generated for you. When using vscode serve-web, you'll get a link in the following format: `http://localhost:8000?tkn=12345678-1234-1234-1234-1234567890ab`, the last part of that URL is the connection token.
- You need to have access to this port somehow from the client machine. This can either be via SSH Tunnel (this is how the proprietary vscode remote ssh extension and the open source remote ssh extension do it)
- You will need to install the Remote OSS extension
- You need to configure the runtime arguments for the desktop application to enable the proposed APIs for the extension to work (see Requirements). Add the enable-proposed-api section to that file, save and restart (not reload window) your client. If you do not have this activated, you will not be able to see the remote hosts defined by this plugin.
- You need to configure the host in your settings.json file manually.

### Manual Connection
These steps set up a manual connection over a local network. 
Be careful with the 0.0.0.0-host, if the server you are connecting to has a public IP this means that the port will be available for everyone if it is not protected by a firewall. The recommended way to do it is to manually set this to an internal IP, for example 10.0.0.15

#### On the server
```bash
# Replace the "code" command with vscodium, code-server or openvscode depending on which variant you are using
code serve-web \
    # This is the IP address of the server that your client will be connecting to
    --host 10.0.0.15 \

    # The port, default is 8000
    --port 8000 \

    # Disable telemetry features
    --telemetry-level off \
    # Manually set a connection token
    --connection-token super-secure-connection-token-here
```
You should then receive a message that the server has been started and is listening on the specified port.

#### On the client
For the settings above, add this connection to your client settings.json. You can choose not to provide the connection token here in the settings, which will prompt you for the token when you connect to the server.
```json
{
    "remote.OSS.hosts": [
        {
            "type": "manual",
            "name": "my-server",
            "host": "10.0.0.15",
            "port": 8000,
            "connectionToken": "super-secure-connection-token-here",
            "folders": [],
        }
    ]
}
```

Save the file, and then go to the remote explorer tab on the client. You should see the server there, click on the folder to open the connection.

From that point onwards, the experience is roughly the same as with the official Remote SSH extension

![image](https://github.com/xaberus/vscode-remote-oss/assets/24367830/78c9e29e-2c6a-490c-b7d4-7f2539bb012c)

### Connect to a docker container
Connecting to a docker/devcontainer should work roughly the same way as the manual connection above, except the definition of the host and connection token parameters.
The port used for this extension should be the same port that is used for the web interface.


### VSCodium Server over SSH Tunnel
In this example we are going to connect to a remote host `rem` as declared in our SSH `config`.
We are going to use 8000 as the local port and 11111 as the remote port. (We are assuming that these ports are free.) In summary:

```
local port: 8000
remote port: 11111
commit: c3511e6c69bb39013c4a4b7b9566ec1ca73fc4d5
```

#### On the server
Log in to the remote port and simultaneously setup port forwarding:

```bash
ssh rem -L 8000:localhost:11111
```

Then, on the remote machine download the REH build and put it in some folder. You can use the following update script:

```bash
#!/usr/bin/env bash
set -uexo pipefail

VSCODIUM_DIR="${HOME}/.vscodium-server"
RELEASE_URL="$(curl -Ls -o /dev/null -w '%{url_effective}' 'https://github.com/VSCodium/vscodium/releases/latest')"
RELEASE="${RELEASE_URL##*/}"
PACKAGE="vscodium-reh-linux-x64-${RELEASE}.tar.gz"
DOWNLOAD_URL="https://github.com/VSCodium/vscodium/releases/download/${RELEASE}/${PACKAGE}"

mkdir -p "${VSCODIUM_DIR}"
pushd "${VSCODIUM_DIR}"
curl -Ls -o "${VSCODIUM_DIR}/${PACKAGE}" "${DOWNLOAD_URL}"
COMMIT_ID=$(tar -xf "${VSCODIUM_DIR}/${PACKAGE}" ./product.json -O | jq ".commit" -r)
BIN_DIR="${VSCODIUM_DIR}/bin/${COMMIT_ID}"
mkdir -p "${BIN_DIR}"
pushd "${BIN_DIR}"
tar -xf "${VSCODIUM_DIR}/${PACKAGE}"
popd
ln -sfT "${BIN_DIR}" "${VSCODIUM_DIR}/bin/current"
rm "${VSCODIUM_DIR}/${PACKAGE}"
popd
```

(The above folder structure is inspired by how the remote-ssh extension but is not strictly necessary.)

Start the REH instance:

```bash
export CONNECTION_TOKEN=<secret>
export REMOTE_PORT=11111

~/.vscodium-server/bin/current/bin/codium-server \
    --host localhost \
    --port ${REMOTE_PORT} \
    --telemetry-level off \
    --connection-token ${CONNECTION_TOKEN}
```

Note, that in the above command line we specified the host to be `localhost`. This is important
because the default setting is to listen on `0:0:0:0`. This will expose your REH instance to
outside internet, which you definitely want to avoid. With the localhost setting only local
processes can connect (i.e., the SSH server).

The `CONNECTION_TOKEN` serves as a password that you will be asked every time you connect
to the REH instance.

You have to keep the SSH session running as long as you using the REH. Alternatively, you can use
tools like tmux to create persistent sessions.

#### On your client

Now, to connect your local editor install the extension and add the following section to your `settings.json`:

```json
    "remote.OSS.hosts": [
        {
            "type": "manual",
            "name": "local",
            "host": "127.0.0.1",
            "port": 8000,
            "folders": [
                {
                    "name": "project",
                    "path": "/home/user/project",
                },
            ],
        }
    ]
```

Now you should be able to trigger a connection from the "Remote Explorer" tree view. You should see a tree that allows you to connect either to the REH instance directly or to a folder you specified in the config.

Trigger either one and you will be asked for the connection token you specified above.

Have fun!

## Release Notes

...

### 0.0.4
Properly encode the remote label so it survives a round-trip through the URI parser.

### 0.0.3
Enabled port view and added an example update bash script.

### 0.0.2

Added a new config option (`connectionToken`) to host configurations.
Set it to a string to provide a fixed connection token. Alternatively,
set it to boolean value `false` to completely disable connection tokens.
The default value is `true`. Be ware that by saving the token in the
config JSON you might compromise the little security might have initially
provided.

### 0.0.1

Initial release of Remote OSS
