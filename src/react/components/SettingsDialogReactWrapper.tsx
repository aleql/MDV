import { observer } from "mobx-react-lite";
import { BaseDialog } from "../../utilities/Dialog";
import { createEl } from "../../utilities/ElementsTyped";
import { createMdvPortal } from "@/react/react_utils";
import Gui from "./SettingsDialogComponent";
import type { Chart } from "@/charts/charts";

const SettingsDialog = observer(({chart}: {chart: Chart}) => {
    // const config = chart.getConfig(); //instrument with mobx etc
    return (<Gui chart={chart} />)
});


// don't necessarily want to inherit from BaseDialog, could consider different approach.
// this will be more consistent / less work in short-term, and a basis for refactoring later.
class SettingsDialogReactWrapper extends BaseDialog {
    _root: ReturnType<typeof createMdvPortal>;
    get root() { return this._root; }
    set root(v) {
        this._root = v;
    }
    constructor(chart: Chart) {
        // if this is intended to be a drop-in replacement for existing SettingsDialog,
        // it isn't only used by 'charts', but e.g. tracks.
        const name = chart.config.title || `${chart.config.type} ${chart.config.id}`;
        const config = { //TODO review popout behavior, use `__doc` or whatever here instead of `document` when appropriate
            width: 500, title: `Settings (${name})`, doc: chart.__doc__ || document,
            onclose: () => { chart.dialogs.splice(chart.dialogs.indexOf(this), 1) }
        };
        super(config, chart);
    }
    init(chart: Chart) {
        const div = createEl('div', {}, this.dialog);
        this.root = createMdvPortal((
            <SettingsDialog chart={chart} />
        ), div);
    }
    close() {
        super.close();
        // this.root is undefined; wtf?
        // tried adding getter/setter for it - it doesn't got re-assigned.
        // I don't think there's any 'this' weirdness going on here...
        // some kind of react voodoo?
        if (this.root) this.root.unmount();
        else console.warn('not unmounting react root for dialog because of weirdness');
    }
}

export default SettingsDialogReactWrapper;