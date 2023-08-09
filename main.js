const obsidian = require('obsidian');

class SearchInputModal extends obsidian.Modal {
    constructor(app, onEnter) {
    super(app);
    this.onEnter = onEnter;
    this.input = '';
    this.display();
    this.open();
  }

  display() {
    //this.contentEl.addClass("quickAddModal", "qaInputPrompt");
    this.titleEl.textContent = '🔎 Please enter your search term below';
    const mainContentContainer = this.contentEl.createDiv();
    this.inputComponent = this.createInputField(mainContentContainer, "Ex: (file:'xx' path:'xx') OR (tag:'')");
    this.createButtonBar(mainContentContainer);
  }

  createInputField(container, placeholder) {
    const textComponent = new obsidian.TextComponent(container);
    textComponent.inputEl.style.width = "100%";
    textComponent.setPlaceholder(placeholder).onChange((value) => this.input = value);
    textComponent.inputEl.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        this.submit();
      }
    });
    return textComponent;
  }

  createButtonBar(mainContentContainer) {
    const buttonBarContainer = mainContentContainer.createDiv();
    new obsidian.ButtonComponent(buttonBarContainer).setButtonText("Ok").setCta().onClick(() => this.submit());
    new obsidian.ButtonComponent(buttonBarContainer).setButtonText("Cancel").onClick(() => this.cancel());
    buttonBarContainer.style.display = "flex";
    buttonBarContainer.style.flexDirection = "row-reverse";
    buttonBarContainer.style.justifyContent = "flex-start";
    buttonBarContainer.style.marginTop = "1rem";
    buttonBarContainer.style.gap = "0.5rem";
  }

  submit() {
    this.onEnter(this.input);
    this.close();
  }

  cancel() {
    this.close();
  }

  onOpen() {
    this.inputComponent.inputEl.focus();
    this.inputComponent.inputEl.select();
  }
}

class TemplateSuggester extends obsidian.FuzzySuggestModal {
  constructor(app, templateFolder, onSelect) {
    super(app);
    this.templateFolder = templateFolder;
    this.onSelect = onSelect;
  }

  getItems() {
    return this.templateFolder.children.filter(file => file instanceof obsidian.TFile);
  }

  getItemText(item) {
    return item.basename;
  }

  onChooseItem(item) {
    this.onSelect(item);
  }
}

class TemplateSearchPlugin extends obsidian.Plugin {
  settings = {};
  async onload() {

    await this.loadSettings();

    this.addCommand({
      id: 'free-search',
      name: 'Free Search',
      callback: this.freeSearch.bind(this),
    });

    this.addCommand({
      id: 'template-search',
      name: 'Template-Enabled Search',
      callback: this.templateSearch.bind(this),
    });

    this.addSettingTab(new TemplateSearchSettingTab(this.app, this));
  }



  async freeSearch() {
    new SearchInputModal(this.app, (searchQuery) => {
        this.executeSearch(searchQuery);
    }).open();


  }

  async templateSearch() {
    const templateFolder = await this.app.vault.getAbstractFileByPath(this.settings.templateFolder);
    new TemplateSuggester(this.app, templateFolder, async (selectedTemplate) => {
      let templateQuery = await this.app.vault.read(selectedTemplate);
      templateQuery = await this.app.plugins.plugins.quickadd.api.format(templateQuery)
      this.executeSearch(templateQuery);
    }).open();

  }

  async executeSearch(searchQuery) {
    //Open search view 
        await this.app.commands.commands["global-search:open"].callback()
        const searchSpace = this.app.workspace.leftRibbon.workspace.activeLeaf.view
        searchSpace.searchComponent.setValue(searchQuery)
        await searchSpace.startSearch()

        
        //Open Graph view and search
        await this.app.commands.commands["graph:open"].callback();
        const appWorkspace = this.app.workspace

        function setGraphSearch(){

            let graphSearch = appWorkspace.activeLeaf.view.dataEngine;
            graphSearch.filterOptions.search.inputEl.value = searchQuery
            graphSearch.updateSearch()

        }

        function tryGraphSearch(){
            try {
                setGraphSearch()

            } catch {
                setTimeout(() => {
                    tryGraphSearch()
                }, 20)
            }
        }
        tryGraphSearch()

  }


  async loadSettings() {
    this.settings = Object.assign({}, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class TemplateSearchSettingTab extends obsidian.PluginSettingTab {
  plugin;

  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;

    containerEl.empty();

    new obsidianSetting(containerEl)
      .setName('Search Templates Folder')
      .setDesc('Select the folder containing your search templates')
      .addButton(button => {
        button.setButtonText(this.plugin.settings.templateFolder || 'Select Folder')
          .setCta()
          .onClick(() => {
            new FolderSuggester(this.app, (folder) => {
              this.plugin.settings.templateFolder = folder;
              this.plugin.saveSettings();
              button.setButtonText(folder);
            }).open();
          });
      });
  }
}

class FolderSuggester extends obsidian.FuzzySuggestModal {
  onSelect;

  constructor(app, onSelect) {
    super(app);
    this.onSelect = onSelect;
  }

  getItems() {
    return this.app.vault.getAllLoadedFiles().filter(file => file instanceof obsidian.TFolder);
  }

  getItemText(item) {
    return item.path;
  }

  onChooseItem(item) {
    this.onSelect(item.path);
  }
}


module.exports = TemplateSearchPlugin;