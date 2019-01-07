import { WorkspaceFolder } from 'vscode';
import { VSCodeWindow } from '../vscode.interface';

export const getWorkspaceFolder = (vscodeWindow: VSCodeWindow, folders: WorkspaceFolder[] | undefined): string => {
  if (vscodeWindow.activeTextEditor && vscodeWindow.activeTextEditor.document) {
    const foundFolder = (folders || []).find(folder =>
      vscodeWindow.activeTextEditor!.document.fileName.includes(folder.uri.fsPath));

    if (foundFolder) {
      return foundFolder.uri.fsPath;
    }
  }

  if (!folders) {
    return '';
  }

  const folder = (folders[0] || {}) as WorkspaceFolder;
  const uri = folder.uri;

  return uri.fsPath;
};
