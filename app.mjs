import request from "request";
import cheerio from "cheerio";

const BASE_URL = process.argv.slice(2)[0];
const SEARCH_TEXT = process.argv.slice(2)[1];

const handleGetSiteBodyRequest = async (URL) => {
     return new Promise(resolve => {
         request( URL,
             (error, response, body) => {
                 if(!error){
                     resolve(body);
                 }
             }
         )
    })
}

const handleGetWebSiteLinks = (body) => {
    const baseUrl = BASE_URL.slice(-1) === "/" ? BASE_URL.slice(0, -1) : BASE_URL;
    const linksHref = [];

    let $ = cheerio.load(body);
    let links = $('a');

    $(links).each(function(i, link){
        const href = $(link).attr('href');

        if(href && href[0] !== "#" && href !== "/"){
            if(href.indexOf("http") !== -1 && href.indexOf(baseUrl) !== -1){
                linksHref.push(href)
            }else if(href.indexOf("http") === -1){
                const baseHref = href[0] === '/' ? href.slice(1) : href;

                linksHref.push(`${baseUrl}/${baseHref}`)
            }
        }
    });

    return linksHref;
}

const handleFindTextOnPage = async ( url ) => {
    const siteBody = await handleGetSiteBodyRequest(url);

    let $ = cheerio.load(siteBody);
    const bodyText = $('body').text();
    const result = bodyText
        .replace(/[\x00-\x1F\x7F-\x9F]/g, " ")
        .split(" ")
        .filter(item => item !== "");
    const resultArr = [];

    for(let i=0; i < result.length; i++) {
        if(result[i].indexOf(SEARCH_TEXT) !== -1) {
            const newContext = [];

            newContext.push(result[i-1]);
            newContext.push(result[i]);
            newContext.push(result[i+1]);

            resultArr.push(newContext.join(" "));
        }
    }

    return { url, text: resultArr };
}

const handleSearchTextResult = async ( siteUrls ) => {
    return Promise.allSettled(
        siteUrls.map(( url ) => handleFindTextOnPage(url))
    );
}

const handleStartCrawler = async (url, urlData = []) => {
    const siteBody = await handleGetSiteBodyRequest(url);
    const webSiteData = handleGetWebSiteLinks(siteBody, url);
    const newLinksUrl = webSiteData.filter((url) => urlData.indexOf(url) === -1);
    const uniqueNewUrls = newLinksUrl.filter((item, pos, self) => ( self.indexOf(item) === pos ));

    if(!uniqueNewUrls.length){
        return urlData;
    }else{
        const results = [];
        const arrOfResults = await Promise.allSettled(
            uniqueNewUrls.map(( url ) => handleStartCrawler(url, [...urlData, ...uniqueNewUrls]))
        );

        arrOfResults.forEach(({ value }) => {
            value.forEach(( item ) => {
                if(!results.includes(item)){
                    results.push(item)
                }
            })
        })

        return results;
    }
}

(async () => {
    const allUrls = await handleStartCrawler(BASE_URL);
    const searchTextResult = await handleSearchTextResult(allUrls);
    const pageWithSearchText = searchTextResult.filter(({ value }) => value.text.length);

    console.log(`Crawled ${allUrls.length} pages. Found ${pageWithSearchText.length} pages with the term ‘${SEARCH_TEXT}’:`)

    pageWithSearchText.forEach(({value}) => {
        const message = `${value.url} => '${value.text.join(', ')}'`
        console.log(message)
    })
})();