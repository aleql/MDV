import type { DataColumn } from "../charts/charts";
import type DataStore from "../datastore/DataStore";
import { DataModel } from "./DataModel";

//multitext was buggy (empty data buffer after loading project)
//at least one multitext bug has been fixed, but we're still using text for now.
type TagColumn = DataColumn<'text'>;

const SEP = /\W*\;\W*/; //separate by semi-colon with whitespace trimmed
const JOIN = '; '; //join with semi-colon and space.

const splitTags = (value: string) => value.split(SEP).filter(v=>v);


/** Treating `col.values` as strings containing semi-colon-separated 'tags',
 * find all the indices that include 'tag' as one of those tags.
 */
function getTagValueIndices(tag: string, col: TagColumn) {
    if (tag.match(SEP)) throw new Error('getTagValueIndices: tag must not contain separator (should be handled before calling this function)');
    return col.values.map((v, i) => v.split(SEP).includes(tag) ? i : -1).filter(i => i !== -1);
}

export default class TagModel {
    readonly tagColumn: TagColumn;
    readonly dataModel: DataModel;
    listeners: (()=>void)[] = [];
    constructor(dataStore: DataStore, columnName = '__tags') {
        this.dataModel = new DataModel(dataStore, {autoupdate: true});
        this.dataModel.updateModel();
        //nb, this will replace any other "tag" listener on model (but the model is local to this object)
        this.dataModel.addListener("tag", () => {
            this.listeners.map(callback => callback());
        })
        if (!dataStore.columnIndex[columnName]) {
            // subgroup - user annotations?
            const columnSpec = {name: columnName, datatype: 'text', editable: true, separator: ';', field: columnName};
            const data = new SharedArrayBuffer(dataStore.size * 2);
            dataStore.addColumn(columnSpec, data);
        }
        this.tagColumn = dataStore.columnIndex[columnName];
    }
    addListener(callback: ()=>void) {
        this.listeners.push(callback);
        return callback;
    }
    removeListener(callback: ()=>void) {
        const i = this.listeners.indexOf(callback);
        if (i !== -1) this.listeners.splice(i, 1);
    }
    setTag(tag: string, tagValue = true) {
        setTag({tag, ...this}, tagValue);
        this.dataModel.updateModel(); //seems necessary after-all
        //^^ not exactly intended design, should test more...
    }
    getTags() {
        return getTags(this.tagColumn);
    }
    entireSelectionHasTag(tag: string) {
        const col = this.tagColumn;
        if (tag.match(SEP)) return tag.split(SEP).every(t => this.entireSelectionHasTag(t));
        const tagIndices = getTagValueIndices(tag, col);
        return !this.dataModel.data.some(v => !tagIndices.includes(col.data[v]));
    }
    getTagsInSelection() {
        const {dataModel, tagColumn: col} = this;
        const usedValuesByIndex = new Set<number>();
        for (const i of dataModel.data) {
            usedValuesByIndex.add(col.data[i]);
        }
        const values = [...usedValuesByIndex].map(i => col.values[i]);
        return new Set(values.flatMap(splitTags));
    }
}

function getValueIndex(value: string, col: TagColumn) {
    let i = col.values.indexOf(value);
    if (i === -1) {
        col.values.push(value);
        if (col.values.length > 256) throw new Error(`text column '${col.name}' exceeded 256 values when adding '${value}'`);
        i = col.values.length - 1;
    }
    return i;
}
function setTag(obj: {tag: string, tagColumn: TagColumn, dataModel: DataModel}, tagValue = true) {
    const {tag, tagColumn, dataModel} = obj;
    setTagOnAllSelectedValues(tag, tagColumn, dataModel, true, tagValue);
}
function setTagOnAllSelectedValues(tagToChange: string, col: TagColumn, dataModel: DataModel, notify = true, tagValue = true) {
    // if (dataModel.data.length == 0) {
    //     setTagOnAllValues(tag, col, dataModel, notify); //don't want to maintain permutations like this.
    //     return;
    // }
    sanitizeTags(col);
    if (tagToChange.match(SEP)) {
        const changed = tagToChange.split(SEP)
        .map(t => setTagOnAllSelectedValues(t, col, dataModel, false, tagValue))
        .reduce((a, b) => a || b, false);
        //todo check if this is the right way to handle notify
        if (notify && changed) dataModel.dataStore.dataChanged([col.name]);
        return;
    }
    const indicesWithTag = getTagValueIndices(tagToChange, col); //refers to values that already contain 'tag'

    //If tagValue is true, map from the index of the value without the tag, to the index of the value with the tag.
    //If false, the opposite.
    //-1 if a value with corresponding set of tags doesn't (yet) exist.
    //As we process the list, every time we need to use a new combination of tags (a new value), those -1 values will be set,
    //but we don't add new values until we know we need them.
    const mapToAlteredTag = new Map<number, number>();
    if (tagValue) {
        col.values.filter((_, i) => !indicesWithTag.includes(i)).forEach((v, i) => {
            const tags = [tagToChange, ...splitTags(v)].sort(); //sort *after* adding tag
            //we could assert !tags.includes(tag) before it was added
            const valueWithTag = tags.join(JOIN);
            mapToAlteredTag.set(i, col.values.indexOf(valueWithTag));
        });
    } else {
        col.values.filter((_, i) => indicesWithTag.includes(i)).forEach((v, i) => {
            const tags = splitTags(v).filter(t => t !== tagToChange).sort();
            const valueWithoutTag = tags.join(JOIN);
            mapToAlteredTag.set(i, col.values.indexOf(valueWithoutTag));
        });
    }

    const {data} = dataModel;
    let count = 0;
    for (let i=0; i<data.length; i++) {
        // if data was a bitmap, we'd just do binary operations on our value
        // so things like searching, adding tag would be very quick, but we might use a bit more space
        // maybe we'd probably need more changes... but perhaps it would be clearer separation
        // to introduce a new datatype with explicit semantics than hacking on top of 'text'?
        // this method is a bit unintuitive to write, and could be a source of bugs.
        const currentVal = col.data[data[i]];
        
        if (tagValue === indicesWithTag.includes(currentVal)) continue;
        count++;
        // we've found a row that doesn't have the tag... if we were to add the tag, 
        // would that be a new value (ie, nothing else would have that combination of tags)?
        const untaggedIndex = currentVal;
        let taggedIndex = mapToAlteredTag.get(untaggedIndex);
        // undefined should be never, but it looks like that logic isn't right when removing tags
        if (taggedIndex === undefined || taggedIndex === -1) {
            const untaggedValue = col.values[untaggedIndex];
            const tags = splitTags(untaggedValue);
            const alteredTags = tagValue ? [tagToChange, ...tags] : tags.filter(t => t !== tagToChange);
            const taggedValue = alteredTags.sort().join(JOIN);
            taggedIndex = getValueIndex(taggedValue, col);
            mapToAlteredTag.set(untaggedIndex, taggedIndex);
        }
        col.data[data[i]] = taggedIndex;
    }
    // console.log(`updated ${count}/${data.length} selected rows`);
    if (notify && count) dataModel.dataStore.dataChanged([col.name]);
    return count !== 0; //return whether any changes were made
}

/** processes a given column so that tags appear in sorted order and without repitition.
 * Note that this may potentially alter data in rows that where the corresponding value already
 * satisfied these conditions.
 */
function sanitizeTags(col: TagColumn, notify = false) {
    const vals = col.values.map((unsorted, i) => {
        const sorted = [...new Set(splitTags(unsorted))].sort().join(JOIN);
        return {i, unsorted, sorted};
    });
    const alreadySorted = vals.filter(v => v.sorted === v.unsorted);
    if (alreadySorted.length === vals.length) return;
    console.log('sanitizing tags...'); //not expected to happen unless other non-tag operations are performed on col?
    const values = alreadySorted.map(v => v.sorted);
    if (values.length > 256) throw new Error(`text column '${col.name}' exceeded 256 values when sanitizing tags`);
    col.values = values;
    
    const mapToSorted = new Map<number, number>();
    // we go over all vals, as values that are to be kept (alreadySorted) may still have their indices changed.
    for (const v of vals) {
        const {i, sorted} = v;
        mapToSorted.set(i, getValueIndex(sorted, col));
    }
    const usedValuesByIndex = new Set<number>();
    for (const i in col.data) {
        const j = mapToSorted.get(col.data[i]);
        col.data[i] = j;
        usedValuesByIndex.add(j);
    }
    const nUnused = vals.length - usedValuesByIndex.size;
    if (nUnused) {
        // ugh, we may want to do another pass... make sure to actually test when I implement this.
        console.warn(`sanitizeTags left ${nUnused} unused values...`);
    }
    if (notify) console.warn('sanitizeTags notify ignored');
}

function getTags(col: TagColumn) {
    return new Set(col.values.flatMap(splitTags));
}

function getTagsInSelection(col: TagColumn, dataModel: DataModel) {
    const usedValuesByIndex = new Set<number>();
    for (const i of dataModel.data) {
        usedValuesByIndex.add(col.data[i]);
    }
    const values = [...usedValuesByIndex].map(i => col.values[i]);
    return new Set(values.flatMap(splitTags));
}