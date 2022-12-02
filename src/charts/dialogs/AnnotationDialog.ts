import { DataModel } from "../../table/DataModel.js";
import { getTags, getTagsInSelection, setTag, setTagOnAllSelectedValues } from "../../table/DataTagOperations";
import {BaseDialog} from "../../utilities/Dialog.js";
import {createEl} from "../../utilities/Elements.js";
import { DataColumn, DataSource } from "../charts.js";


export default class AnnotationDialog extends BaseDialog {
    tagColumn: DataColumn<'text'>;
    dataModel: DataModel;
    tagList: HTMLDivElement;
    tagInput: any;
    constructor(dataSource: DataSource) {
        super({
            title: "Annotate selection",
            width: 400,
            height: 400,
            columns: 2,
            buttons: [
                {
                    text: "Add tag to selection",
                    method: () => {
                        const tag = this.tagInput.value;
                        setTag({tag, ...this});
                        this.updateTagList();
                    }
                },
                {
                    text: "Remove tag from selection",
                    method: () => {
                        const tag = this.tagInput.value;
                        setTag({tag, ...this}, false);
                        this.updateTagList();
                    }
                },
            ]
        }, null);
        this.outer.classList.add('annotationDialog');
        // is there a '__tags' column? if so, use it, otherwise add it.
        const {dataStore} = dataSource;
        const dataModel = new DataModel(dataStore, {autoupdate: true});
        dataModel.updateModel();
        this.dataModel = dataModel;
        if (!dataStore.columnIndex['__tags']) dataModel.createColumn('__tags', null);
        this.tagColumn = dataStore.columnIndex['__tags'];

        const tagInput = createEl("input", {}, this.columns[0]); //chrome treats as password field (but without hidden value)?
        this.tagInput = tagInput;
        // const addTagButton = createEl("button", {text: "Add tag to selection", classes:["ciview-button"]}, this.columns[1]);
        // addTagButton.addEventListener("click", () => {
        //     setTagOnAllSelectedValues(tagInput.value, this.tagColumn, dataModel);
        //     this.updateTagList();
        // });
        this.tagList = createEl("div", {}, this.columns[0]);
        this.updateTagList();
    }
    updateTagList() {
        const tags = [...getTags(this.tagColumn)];
        const els = tags.map(tag => `<li>${tag}</li>`);
        this.tagList.innerHTML = `<h2>all tags:</h2>
        <ul>${els.join('')}</ul>
        <h2>tags used in selection:</h2>
        <ul>
        ${[...getTagsInSelection(this.tagColumn, this.dataModel)].map(tag => `<li>${tag}</li>`).join('')}
        </ul>
        `;
    }
}
