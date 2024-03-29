// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IRunningSessions,
  IRunningSessionManagers,
  RunningSessionManagers,
  RunningSessions
} from '@jupyterlab/running';

import { Session } from '@jupyterlab/services';
import { PathExt } from '@jupyterlab/coreutils';
import { toArray } from '@phosphor/algorithm';

/**
 * The class name added to a notebook icon.
 */
const NOTEBOOK_ICON_CLASS = 'jp-mod-notebook';

/**
 * The class name added to a console icon.
 */
const CONSOLE_ICON_CLASS = 'jp-mod-console';

/**
 * The class name added to a file icon.
 */
const FILE_ICON_CLASS = 'jp-mod-file';

/**
 * The default running sessions extension.
 */
const plugin: JupyterFrontEndPlugin<IRunningSessionManagers> = {
  activate,
  id: '@jupyterlab/running-extension:plugin',
  provides: IRunningSessionManagers,
  optional: [ILayoutRestorer],
  autoStart: true
};

/**
 * Export the plugin as default.
 */
export default plugin;

/**
 * Activate the running plugin.
 */
function activate(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer | null
): IRunningSessionManagers {
  let runningSessionManagers = new RunningSessionManagers();
  let running = new RunningSessions(runningSessionManagers);
  running.id = 'jp-running-sessions';
  running.title.iconClass = 'jp-RunningIcon jp-SideBar-tabIcon';
  running.title.caption = 'Running Terminals and Kernels';

  // Let the application restorer track the running panel for restoration of
  // application state (e.g. setting the running panel as the current side bar
  // widget).
  if (restorer) {
    restorer.add(running, 'running-sessions');
  }
  addKernelRunningSessionManager(runningSessionManagers, app);
  // Rank has been chosen somewhat arbitrarily to give priority to the running
  // sessions widget in the sidebar.
  app.shell.add(running, 'left', { rank: 200 });

  return runningSessionManagers;
}

/**
 * Add the running kernel manager (notebooks & consoles) to the running panel.
 */
function addKernelRunningSessionManager(
  managers: IRunningSessionManagers,
  app: JupyterFrontEnd
) {
  let manager = app.serviceManager.sessions;
  function filterSessions(m: Session.IModel) {
    return !!(
      (m.name || PathExt.basename(m.path)).indexOf('.') !== -1 || m.name
    );
  }

  managers.add({
    name: 'Kernel',
    running: () => {
      return toArray(manager.running())
        .filter(filterSessions)
        .map(model => new RunningKernel(model));
    },
    shutdownAll: () => manager.shutdownAll(),
    refreshRunning: () => manager.refreshRunning(),
    runningChanged: manager.runningChanged
  });

  class RunningKernel implements IRunningSessions.IRunningItem {
    constructor(model: Session.IModel) {
      this._model = model;
    }
    open() {
      let { path, type } = this._model;
      if (type.toLowerCase() === 'console') {
        void app.commands.execute('console:open', { path });
      } else {
        void app.commands.execute('docmanager:open', { path });
      }
    }
    shutdown() {
      return manager.shutdown(this._model.id);
    }
    iconClass() {
      let { name, path, type } = this._model;
      if ((name || PathExt.basename(path)).indexOf('.ipynb') !== -1) {
        return NOTEBOOK_ICON_CLASS;
      } else if (type.toLowerCase() === 'console') {
        return CONSOLE_ICON_CLASS;
      }
      return FILE_ICON_CLASS;
    }
    label() {
      return this._model.name || PathExt.basename(this._model.path);
    }
    labelTitle() {
      let { kernel, path } = this._model;
      let kernelName = kernel.name;
      if (manager.specs) {
        const spec = manager.specs.kernelspecs[kernelName];
        kernelName = spec ? spec.display_name : 'unknown';
      }
      return `Path: ${path}\nKernel: ${kernelName}`;
    }

    private _model: Session.IModel;
  }
}
