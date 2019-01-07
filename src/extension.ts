import * as vscode from 'vscode';
import { getWorkspaceFolder } from './utils/workspace-utils';
import { CodeceptContext } from './codecept-context';

export function activate(context: vscode.ExtensionContext) {
	const workspaceRoot: string = getWorkspaceFolder(vscode.workspace.workspaceFolders);
	const codeceptContext = new CodeceptContext(workspaceRoot, vscode.window);

	let disposable = vscode.commands.registerCommand('extension.generateStepsFromFeatures', async () => {
		const openFile = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.document.fileName
			: '';

		const stepGenerator = await codeceptContext.getStepGenerator(openFile);
		await stepGenerator.execute(undefined, false);
	});

	let disposableGenerateAll = vscode.commands.registerCommand('extension.generateStepsFromAllFeatures', async () => {
		const stepGenerator = await codeceptContext.getStepGenerator();
		await stepGenerator.executeAll();
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(disposableGenerateAll);
	context.subscriptions.push(codeceptContext);
}

// this method is called when your extension is deactivated
export function deactivate() {}
