const page=(id,name,url=`https://app.notion.com/p/${id}`)=>Object.freeze({id,name,url});
const dataSource=(dataSourceId,databaseId,name,url=`https://app.notion.com/p/${databaseId}`)=>Object.freeze({dataSourceId,databaseId,name,url});

export const TDAS_SOURCE_MANIFEST=Object.freeze({
 schemaVersion:'1.1.0',
 project:'SEDES/DF — TDAS Técnico Administrativo',
 cargo:'202',
 root:page('363cf5a26731816ea702c9a8c6ea11dc','Dashboard PRO'),
 editalCheck:page('3b8cf5a2673181c4a724c9e4afc7d49d','Check do Edital — Cargo 202'),
 editalChecklist:dataSource('24c1299f-10a5-4125-b7f6-c19846d8aa52','c14d2d3f70624fbc9b6694997501f503','Checklist do Edital — Cargo 202'),
 planningRoot:page('366cf5a26731819f8f43f82bd74fda2d','Macro oficial + Micros semanais'),
 macro:page('363cf5a2673181eb923ac2c7015dbad6','Macro completo PE01–PE112'),
 micros:Object.freeze([
  page('363cf5a2673181afbe71eb9b8c6e4157','Micro PE01–PE07'),
  page('363cf5a2673181f6b01af03482ba9410','Micro PE08–PE14'),
  page('363cf5a2673181a7a2becc146fbb7f2c','Micro PE15–PE21'),
  page('363cf5a2673181dd8d57fdd3203007f1','Micro PE22–PE28'),
  page('363cf5a2673181dd87a7c5db2f2a22b5','Micro PE29–PE35'),
  page('363cf5a267318199b26ecfb946699d25','Micro PE36–PE42'),
  page('363cf5a2673181d3a504f6cac7efb2dd','Micro PE43–PE49'),
  page('363cf5a26731814fa8cbd7583b368de4','Micro PE50–PE56'),
  page('363cf5a2673181248ef1c08242811636','Micro PE57–PE63'),
  page('363cf5a2673181c0b48fd6cca4b628b0','Micro PE64–PE70'),
  page('363cf5a26731810b833acfbf6889948b','Micro PE71–PE77'),
  page('363cf5a2673181b9992cebdb01d91e42','Micro PE78–PE84'),
  page('363cf5a267318131b541d5bbb617a826','Micro PE85–PE91'),
  page('363cf5a26731813b9c31d2f7a2b2ff96','Micro PE92–PE98'),
  page('363cf5a2673181879ff1e8bae8992e0d','Micro PE99–PE105'),
  page('363cf5a267318135beedf9b76b9e91ee','Micro PE106–PE112')
 ]),
 execution:Object.freeze({
  materials:page('364cf5a26731813ca00ed9ba45ab6d51','Materiais Premium Diários'),
  questions:page('364cf5a267318105abdbce6966704b5d','Questões Diárias')
 }),
 archive:page('366cf5a2673181848b4dc697645626cc','Arquivo e versões antigas preservadas'),
 priority:Object.freeze([
  'Edital oficial e cronograma oficial',
  'Macro PE01–PE112 auditado',
  'Micro semanal atualizado',
  'Banco de Controle de Questões TDAS',
  'Caderno de Erros TDAS / PRO',
  'Banco de Redação TDAS',
  'Materiais complementares'
 ])
});

export const microWeekForPe=pe=>Math.ceil((Number(String(pe||'').replace(/\D/g,''))||0)/7);
export const microPageForPe=pe=>TDAS_SOURCE_MANIFEST.micros[microWeekForPe(pe)-1]||null;
