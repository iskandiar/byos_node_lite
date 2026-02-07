import {prepareData, TemplateDataType} from "Data/PrepareData.js";
import {PNGto1BIT} from "./PNGto1BIT.js";
import {TEMPLATE_FOLDER, CALENDAR_IDS} from "Config.js";
import App from "Template/JSX/App.js";
import AppCalendars from "Template/JSX/AppCalendars.js";
import {fetchCalendarColumns, CalendarMetadata} from "Data/FetchGoogleCalendars.js";
import {renderToImage} from "./RenderHTML.js";
import {buildLiquid} from "./BuildLiquid.js";
import {buildJSX} from "./BuildJSX.js";
import crypto from "crypto";
import {readFileSync} from "node:fs";
import {getOrderedCalendars} from "../CalendarConfig.js";

const headerHtml = readFileSync(TEMPLATE_FOLDER + '/Header.html', 'utf8');

const screens = [
    // you can leave one or add more
    (data: TemplateDataType) => buildJSX(AppCalendars, data)
    // (data: TemplateDataType) => buildJSX(App, data),
    // (data: TemplateDataType) => buildLiquid('HackerNews', data),
];

export async function buildScreen() {
    const randomScreen = screens[Math.floor(Math.random() * screens.length)];
    const templateData = await prepareData();
    // If calendar envs are configured, fetch and attach calendar columns
    try {
        const configuredCalendars = getOrderedCalendars();
        
        // Convert calendars to metadata format for fetching
        const calendarMetadata: CalendarMetadata[] = configuredCalendars.map(cal => ({
            id: cal.id!,
            isWorkCalendar: cal.type === 'work'
        }));

        if (!calendarMetadata.length) return templateData;

        // Fetch and display calendars in order: Work (1st), Life (2nd), Training (3rd)
        const columns = await fetchCalendarColumns(calendarMetadata);
        configuredCalendars.forEach((calendar, idx) => {
            const col = columns[idx];
            const count = col?.events.length ?? 0;
            const moreCount = col?.moreCount ?? 0;
            console.log(`GCAL[${idx + 1} ${calendar.label}] count=${count} moreCount=${moreCount} calendarId=${calendar.id}`);
        });
        (templateData as any).calendarColumns = columns;
    } catch (err: any) {
        console.error('Failed to fetch Google calendars', err?.message ?? err);
    }
    const html = await randomScreen(templateData);
    const image = await renderToImage(headerHtml + html);
    return PNGto1BIT(image);
}

export async function getScreenHash() {
    const image = await buildScreen();
    return crypto.createHash('sha256').update(image).digest('hex');
}

export async function checkImageUrl(url: string): Promise<boolean> {
    let response;
    try {
        response = await fetch(url);
    } catch (error: any) {
        console.error(`Failed to check image ${url} - ${error.message}`);
        return false;
    }
    if (!response.ok) {
        console.error(`Failed to check image ${url} - got ${response.status} code`);
        return false;
    }
    const data = await response.text();
    if (data.length < 1000) {
        console.error(`Failed to check image ${url} - no content`);
        return false;
    }
    return true;
}
