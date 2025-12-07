import {prepareData, TemplateDataType} from "Data/PrepareData.js";
import {PNGto1BIT} from "./PNGto1BIT.js";
import {TEMPLATE_FOLDER} from "Config.js";
import App from "Template/JSX/App.js";
import AppCalendars from "Template/JSX/AppCalendars.js";
import {fetchCalendarColumns} from "Data/FetchICS.js";
import {renderToImage} from "./RenderHTML.js";
import {buildLiquid} from "./BuildLiquid.js";
import {buildJSX} from "./BuildJSX.js";
import crypto from "crypto";
import {readFileSync} from "node:fs";

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
    // If ICS_URLS is configured in env (comma separated), fetch and attach calendar columns for the upcoming work day
    try {
    const ics = process.env['ICS_URLS'];
        if (ics) {
            const urls = ics.split(',').map(s => s.trim()).filter(Boolean);
            if (urls.length) {
                const columns = await fetchCalendarColumns(urls);
                (templateData as any).calendarColumns = columns;
            }
        }
    } catch (err: any) {
        console.error('Failed to fetch ICS calendars', err?.message ?? err);
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
