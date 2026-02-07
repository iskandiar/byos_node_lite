import {TIMEZONE} from "Config.js";
import {getHackerNews, HackerNewsData} from "./HackerNewsData.js";

export type TemplateDataType = {
    time: string
    hackerNews: HackerNewsData,
    // optional calendar columns populated via Google Calendar API
    calendarColumns?: Array<{
        events: Array<{
            id?: string,
            summary?: string,
            start?: string,
            end?: string,
        }>,
        moreCount: number
    }>
}

export async function prepareData(): Promise<TemplateDataType> {
    const time = new Date().toLocaleTimeString(undefined, {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const hackerNews = await getHackerNews();
    return {
        time,
        hackerNews,
    }
}
