import View from './views/view';
import Editor from './views/editor';
import Vocab from './views/vocab';
import PagedCollection from './views/pagedcollection';
import UserSettings from './views/usersettings';
import CreateNew from './views/createnew';
import Import from './views/import';
import About from './views/about';
import Help from './views/help';

export default class Loader {

  /*
    This class loads the corresponding JS files for the current bodyId.
  */

  constructor() {
    this.views = [];
  }

  createViews() {
    // Creates instances of our different classes.
    // TODO: Should probably be done on demand.
    this.baseView = new View('Base');
    this.createView(new Editor('Editor'));
    this.createView(new Vocab('Vocab'));
    this.createView(new PagedCollection('PagedCollection'));
    this.createView(new UserSettings('UserSettings'));
    this.createView(new CreateNew('CreateNew'));
    this.createView(new Import('Import'));
    this.createView(new About('About'));
    this.createView(new Help('Help'));
  }

  createView(view) {
    this.views.push(view);
  }

  getCurrentView() {
    return this.currentView;
  }

  initPage(id) {
    // This method should be called on page load.

    // Find the corresponding view script and select it
    const bodyId = id;
    for (let i = 0; i < this.views.length; i++) {
      if (this.views[i].name.toLowerCase() === bodyId.toLowerCase()) {
        this.currentView = this.views[i];
      }
    }

    // If none found, select base
    if (!this.currentView) {
      console.warn('No corresponding view script. Loading base.')
      this.currentView = this.baseView;
    } else {
      // console.log('Loading view script:', this.currentView.name);
    }

    // Load the selected view
    this.currentView.initialize();
    return true;
  }
}
