// Names are evidenced; no source below supplies a verified stage polygon.
// Explicit identity links only: similar names never associate unrelated parks.
export const catalog = {
  schema:'dendrogeo/park-stage-evidence/v1', revision:'2026-10-24.1',
  groups:[
    {
      id:'tr-ankara-dikmen-vadisi', name:'Dikmen Vadisi',
      parkKeys:['relation/14290362'],
      sources:[{
        id:'abb-sports-2021', publisher:'Ankara Büyükşehir Belediyesi', date:'2021-06-07',
        url:'https://www.ankara.bel.tr/tr/duyurular/baskent-parklarinda-spor-basliyor-57',
        establishes:'section-names-only'
      }],
      sections:[
        {id:'dikmen-1-2', name:'1–2. etap bölümü', nameSource:'abb-sports-2021', boundaryStatus:'missing'},
        {id:'dikmen-3', name:'3. etap bölümü', nameSource:'abb-sports-2021', boundaryStatus:'missing'}
      ]
    },
    {
      id:'tr-ankara-ovecler-rekreasyon', name:'Öveçler Rekreasyon Alanı',
      parkKeys:[], // No verified park identity link; do not match by name.
      sources:[{
        id:'abb-wifi-2021', publisher:'Ankara Büyükşehir Belediyesi', date:'2021-08-18',
        url:'https://www.ankara.bel.tr/haberler/mansur-yavas-bir-sozunu-daha-tuttu-14740',
        establishes:'section-names-only'
      }],
      sections:[
        {id:'ovecler-1', name:'Bölüm 1', nameSource:'abb-wifi-2021', boundaryStatus:'missing'},
        {id:'ovecler-2', name:'Bölüm 2', nameSource:'abb-wifi-2021', boundaryStatus:'missing'}
      ]
    }
  ]
};
