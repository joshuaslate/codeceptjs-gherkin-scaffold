import * as vscode from 'vscode';
import { getWorkspaceFolder } from './utils/workspace-utils';
import { CodeceptContext } from './codecept-context';

export function activate(context: vscode.ExtensionContext) {
	const workspaceRoot: string = getWorkspaceFolder(vscode.window, vscode.workspace.workspaceFolders);
	const codeceptContext = new CodeceptContext(workspaceRoot, vscode.window);

	let disposable = vscode.commands.registerCommand('extension.generateStepsFromFeatures', async () => {
		try {
			const openFile = vscode.window.activeTextEditor
				? vscode.window.activeTextEditor.document.fileName
				: '';

			const stepGenerator = await codeceptContext.getStepGenerator(openFile);
			await stepGenerator.execute(undefined, false);
		} catch (err) {
			vscode.window.showErrorMessage(`Error: ${err.message}`);
		}
	});

	let disposableGenerateAll = vscode.commands.registerCommand('extension.generateStepsFromAllFeatures', async () => {
		try {
			const stepGenerator = await codeceptContext.getStepGenerator();
			await stepGenerator.executeAll();
		} catch (err) {
			vscode.window.showErrorMessage(`Error: ${err.message}`);
		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(disposableGenerateAll);
	context.subscriptions.push(codeceptContext);
}

// this method is called when your extension is deactivated
export function deactivate() {}
