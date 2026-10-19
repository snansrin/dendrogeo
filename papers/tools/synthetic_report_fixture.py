"""Generate synthetic tool input in a temporary directory, never a public report.

No withdrawn observations, photographs, accounts or model outputs are recovered.
The deliberately artificial values test serialization and integrity contracts only.
"""
import csv
import hashlib
import json
import math
from pathlib import Path


def create_report(parent):
    report = Path(parent) / 'DGR-2026-9001'
    report.mkdir()
    rows = [dict(id=f'synthetic-{i}', point_id=i, species='SYNTHETIC', grp='YAPRAKLI',
                 girth_cm=30.0+i, dbh_cm=(30.0+i)/math.pi, height_m=3.0,
                 lat=40.0, lon=32.0, carbon_kg=1.0, volume_m3=0.01,
                 acc_m=None if i == 1 else 5.0, date='2026-01-01') for i in range(1, 4)]
    data = dict(rows=rows, generated_at='2026-01-01T00:00:00Z',
                provenance={'git_commit': 'synthetic'}, period={'from': '2026-01-01', 'to': '2026-01-01'},
                geofence={'outside_rows': 0}, qa={'species': {'dev_rho': []}},
                lulc={'review': {'scenes': []}}, study={})
    meta = dict(identifier=report.name, resultHash='synthetic-result', sampleSize=3,
                license='test fixture only', qaState='synthetic', doi=None)
    points = [{'type': 'Feature', 'properties': {}, 'geometry': {'type': 'Point',
               'coordinates': [r['lon'], r['lat']]}} for r in rows]
    surface = [{'type': 'Feature', 'properties': {}, 'geometry': {'type': 'Polygon',
                'coordinates': [[[32, 40], [32.001, 40], [32.001, 40.001], [32, 40]]]}}]
    for name, value in [('data.json', data), ('metadata.json', meta),
                        ('park.geojson', {'type': 'FeatureCollection', 'features': points}),
                        ('surface.geojson', {'type': 'FeatureCollection', 'features': surface})]:
        (report/name).write_text(json.dumps(value), encoding='utf-8')
    with (report/'olcum.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.writer(stream, lineterminator='\n')
        writer.writerow(['NOKTA'])
        writer.writerows([[r['point_id']] for r in rows])
    for name in ['README.md', 'methods.txt', 'LICENSE.txt']:
        (report/name).write_text('SYNTHETIC TEST INPUT; not scientific evidence.\n', encoding='utf-8')
    files = [{'name': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
             for p in sorted(report.iterdir())]
    (report/'manifest.json').write_text(json.dumps(dict(report_id=report.name,
        result_hash='synthetic-result', files=files)), encoding='utf-8')
    return report
