/*
 * This file is part of the nivo project.
 *
 * (c) 2016 Raphaël Benitte
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
'use strict'

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const compression = require('compression')
const path = require('path')
const uuid = require('uuid')
const _ = require('lodash')
const winston = require('winston')
const expressWinston = require('express-winston')
const app = express()
const validate = require('./lib/middlewares/validationMiddleware')
const storage = require('./lib/storage')
const mapping = require('./mapping')
const samples = require('./samples')
const render = require('./lib/render')
const fetch = require('cross-fetch')
const base64 = require('base-64')

app.enable('trust proxy')
app.set('json spaces', 4)
app.use(cors())
app.use(bodyParser.json())
app.use(
	expressWinston.logger({
		transports: [
			new winston.transports.Console({
				json: false,
				colorize: true,
			}),
		],
		meta: false,
		expressFormat: true,
		colorize: true,
	})
)
app.use(compression())

app.get('/', (req, res) => {
	res.send('OK')
})

app.get('/status', (req, res) => {
	res.status(200).json({
		status: 'ok',
		uptime: `${process.uptime()} second(s)`,
		protocol: req.protocol,
		host: req.get('host'),
		env: {
			NODE_ENV: process.NODE_ENV,
		},
	})
})

function asyncSVGHandler(fn) {
	return (req, res) => {
		fn(req, res).then(rendered => {
			res.set('Content-Type', 'image/svg+xml');
			res.status(200);
			res.send(rendered);
		}).catch(err => {
			console.log(err);
			res.status(500);
			res.send(err.toString());
		});
	};
}

function getEnv(name) {
	if (!process.env[name]) {
		console.log(name, 'environment variable required');
		process.exit(1);
	}
	return process.env[name];
}
const PROM_URL = getEnv('PROM_URL');
const PROM_USERNAME = getEnv('PROM_USERNAME');
const PROM_PASSWORD = getEnv('PROM_PASSWORD');

_.forOwn(samples, (sampleConfig, type) => {
	app.get(`/${type}.svg`, asyncSVGHandler(async (req, res) => {
		const apiEndpoint = `${PROM_URL}/api/v1/query?query=`;
		const query = req.query.query;
		const url = apiEndpoint + encodeURIComponent(query);
		const promResponse = await fetch(url, {
			method: 'GET',
			headers: {
				'Authorization': `Basic ${base64.encode(PROM_USERNAME + ":" + PROM_PASSWORD)}`,
				'Cache-Control': 'no-cache',
			},
		});
		if (promResponse.status != 200) {
			throw new Error(await promResponse.text());
		}
		const promResponseJSON = await promResponse.json();

		console.log('=====>', JSON.stringify(promResponseJSON, null, 2))
		const config = {
			...sampleConfig,
			props: {
				...sampleConfig.props,
				width: req.query.width || 800,
				height: req.query.height || 800,
				data: null,
				colors: req.query.colors || [
					'#005ea5',
					'#28a197',
					'#2b8cc4',
					'#6f72af',
					'#2e358b',
					'#912b88',
					'#d53880',
					'#f499be',
					'#ffbf47',
					'#f47738',
					'#b58840',
					'#df3034',
					'#b10e1e',
					'#85994b',
					'#006435',
				]
			},
		};
		if (type === 'pie') {
			config.props.data = promResponseJSON.data.result.map(group => ({
				id: group.metric[Object.keys(group.metric)[0]],
				label: group.metric[Object.keys(group.metric)[0]],
				value: parseFloat(group.value[1]),
			}));

		} else if (type === 'bar' || type === 'radar') {
			config.props.keys = ['value'];
			config.props.indexBy = 'label';
			config.props.data = promResponseJSON.data.result.map(group => ({
				id: group.metric[Object.keys(group.metric)[0]],
				label: group.metric[Object.keys(group.metric)[0]],
				value: parseFloat(group.value[1]),
			}));
		} else {
			throw new Error(`no idea how to convert data into a format for ${type}`);
		}
		console.log('====>', JSON.stringify(config.props.data, null, 2));
		return render.chart(config, {});
	}));
});

const port = process.env.PORT || 3030
app.listen(port, () => {
	console.log(`listening on ${port}`)
})
