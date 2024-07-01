class TabsView {
  constructor() {
    this.activeTab = undefined;
    this.tabGroup = document.getElementById("tabs");

    this.tabGroup.querySelector('.add').addEventListener('click', () => this.addTab());
  }

  addTab() {
    window.api.send('NewWindow').then((id) => {
      this.#setActiveTab(this.#addTab(id));
    });
  }

  deleteTab(element) {
    window.api.send('CloseWindow', Number(element.dataset.id)).then(() => {
      element.remove();
      const tab = this.tabGroup.children.item(this.tabGroup.children.length - 2);

      if(tab) {
        this.setActiveTab(tab)
      }
    });
  }

  setActiveTab(element) {
    window.api.send('ActiveWindow', Number(element.dataset.id)).then(() => {
      this.#setActiveTab(element);
    });
  }

  // <li className="app">
  //  <span className="title">app 1</span>
  //  <span className="close">✕</span>
  // </li>
  #addTab(id) {
    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement('li');
    const title = document.createElement('span');
    const close = document.createElement('span');
    wrapper.dataset.id = id;
    wrapper.className= 'app active';
    title.className = 'title';
    close.className = 'close';

    title.textContent = 'app ' + id;
    close.textContent = '✕';

    fragment.appendChild(title);
    fragment.appendChild(close);
    wrapper.appendChild(fragment);

    title.addEventListener('click', () => this.setActiveTab(wrapper));
    close.addEventListener('click', () => this.deleteTab(wrapper));

    this.tabGroup.insertBefore(wrapper, this.tabGroup.children.item(this.tabGroup.children.length - 1));

    return wrapper;
  }

  #setActiveTab(element) {
    this.activeTab?.classList.remove('active');
    element.classList.add('active');
    this.activeTab = element;
  }
}

window.onload = () => {
  new TabsView().addTab();
}
