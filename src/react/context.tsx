import { createContext, useContext } from "react";
import type { BaseReactChart } from "./components/BaseReactChart";
import type DataStore from "../datastore/DataStore";


const ChartContext = createContext<BaseReactChart<any>>(undefined);
const DataStoreContext = createContext<DataStore>(undefined);


export function ChartProvider({ chart, children }: { chart: BaseReactChart<any> } & React.PropsWithChildren) {
    //DataStoreContext.Provider would be applied at a wider scope if we had a global root & portals.
    return (
    <ChartContext.Provider value={chart}>
        <DataStoreContext.Provider value={chart.dataStore}>
            {children}
        </DataStoreContext.Provider>
    </ChartContext.Provider>)
}

export function useChart() {
    const chart = useContext(ChartContext);
    if (!chart) throw new Error('no chart context');
    //todo: typing...
    return chart;
}
export function useDataStore() {
    const dataStore = useContext(DataStoreContext);
    if (!dataStore) throw new Error('no data store context');
    return dataStore;
}
