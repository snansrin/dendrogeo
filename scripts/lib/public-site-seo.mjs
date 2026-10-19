const origin='https://dendrogeo.org';
export function siteIdentity(){return[
 {'@type':'Organization','@id':origin+'/#organization',name:'DendroGeo',url:origin+'/',logo:{'@type':'ImageObject',url:origin+'/logo.png'},sameAs:['https://github.com/snansrin/dendrogeo','https://doi.org/10.5281/zenodo.22948773']},
 {'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:'DendroGeo',alternateName:'DendroGeo GIS',inLanguage:['tr-TR','en-US'],publisher:{'@id':origin+'/#organization'}}
];}
export function documentIdentity({url,title,description,language='tr',home=false}){
 const name=title.replace(/\s*[|—]\s*DendroGeo$/,'');
 const page={'@type':'WebPage','@id':url+'#webpage',url,name:title,description,inLanguage:language==='en'?'en-US':'tr-TR',isPartOf:{'@id':origin+'/#website'},publisher:{'@id':origin+'/#organization'}};
 if(home)return[...siteIdentity(),page];
 page.breadcrumb={'@id':url+'#breadcrumb'};
 return[page,{'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'DendroGeo',item:origin+'/'},{'@type':'ListItem',position:2,name,item:url}]}];
}
export function applyDocumentIdentity(html,metadata){
 const marker=/<!-- dg-site-identity -->[\s\S]*?<!-- \/dg-site-identity -->\s*/g;
 const graph={'@context':'https://schema.org','@graph':documentIdentity(metadata)};
 const block='<!-- dg-site-identity -->\n<script type="application/ld+json">\n'+JSON.stringify(graph,null,2).replaceAll('<','\\u003c')+'\n</script>\n<!-- /dg-site-identity -->\n';
 return html.replace(marker,'').replace('</head>',block+'</head>');
}
