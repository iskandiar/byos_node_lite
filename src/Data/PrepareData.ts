import {TIMEZONE} from "Config.js";
import {getHackerNews, HackerNewsData} from "./HackerNewsData.js";

export type TemplateDataType = {
    time: string
    hackerNews: HackerNewsData,
    // optional calendar columns populated by ICS fetcher: array of columns, each column is an array of events
    calendarColumns?: Array<Array<{
        id?: string,
        summary?: string,
        start?: string,
        end?: string,
    }>>
}

export async function prepareData(): Promise<TemplateDataType> {
    const time = new Date().toLocaleTimeString(undefined, {
        timeZone: TIMEZONE,
        hour: 'numeric',
    });
    const hackerNews = await getHackerNews();
    return {
        time,
        hackerNews,
    }
}
