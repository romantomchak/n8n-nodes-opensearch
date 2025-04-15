import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeTypeDescription,
	INodeType,
	INodeExecutionData,
	INodePropertyOptions,
	ISupplyDataFunctions,
	SupplyData
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import {
	Client as OpenSearchClient,
	type ClientOptions as OpenSearchClientOptions,
} from '@opensearch-project/opensearch';
import type { Embeddings } from '@langchain/core/embeddings';
import { OpenSearchClientArgs, OpenSearchVectorStore } from '@langchain/community/vectorstores/opensearch';
import https from 'node:https';

import { getConnectionHintNoticeField } from './utils/fields';
import { metadataFilterField } from './utils/sharedFields';
import { NodeOperationMode, VectorStoreFieldOptions, VectorStoreNodeArgs } from "./utils/types";
import {
	handleLoadOperation,
	handleInsertOperation,
	handleUpdateOperation
} from "./operations";

let openSearchClient: OpenSearchClient | null = null;
const sslAgent = new https.Agent({
	rejectUnauthorized: false, // Disable SSL verification
});

async function createOpenSearchClient(context: any): Promise<OpenSearchClient> {
	if (!openSearchClient) {
		const credentials = await context.getCredentials('openSearchApi');

		const clientOptions: OpenSearchClientOptions = {
			node: String(credentials.baseUrl),
			auth: {
				username: String(credentials.username),
				password: String(credentials.password),
			},
		};

		if (credentials.ignoreSSLIssues) {
			clientOptions.ssl = { rejectUnauthorized: false };
			clientOptions.agent = sslAgent;
		}

		openSearchClient = new OpenSearchClient(clientOptions);
	}

	return openSearchClient;
}

async function openSearchIndexSearch(this: ILoadOptionsFunctions) {
	const client = await createOpenSearchClient(this);

	try {
		const response = await client.cat.indices({
			format: 'json'
		});

		const results = response.body.map((index) => ({
			name: index.index,
			value: index.index,
		} as INodePropertyOptions));

		return { results };
	} catch (error) {
		throw new NodeOperationError(this.getNode(), `Error: ${error.message}`);
	}
}

const nodeArgs = {
	async getVectorStoreClient(context, embeddings, itemIndex) {
		const indexName = context.getNodeParameter('indexName', itemIndex, '', {
			extractValue: true,
		}) as string;

		const fieldNames = context.getNodeParameter('options.fieldNames.values', 0, {
			vectorFieldName: 'vector',
			contentFieldName: 'text',
			metadataFieldName: 'metadata',
		}) as VectorStoreFieldOptions;

		const config: OpenSearchClientArgs = {
			client: await createOpenSearchClient(context),
			indexName,
			...fieldNames
		};

		return new OpenSearchVectorStore(embeddings, config);
	}
} as VectorStoreNodeArgs;

export class VectorStoreOpenSearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenSearch Vector Store',
		name: 'vectorStoreOpenSearch',
		description: 'Work with your data in OpenSearch for vector-based search',
		icon: 'file:opensearch.svg',
		group: ['transform'],
		version: 1,
		defaults: {
			name: 'OpenSearch Vector Store',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Vector Stores', 'Tools', 'Root Nodes'],
				Tools: ['Other Tools']
			}
		},
		credentials: [
			{name: 'openSearchApi', required: true}
		],
		inputs: `={{
			((parameters) => {
				const mode = parameters?.mode;
				const inputs = [{ displayName: "Embedding", type: "${NodeConnectionType.AiEmbedding}", required: true, maxConnections: 1}]

				if (mode === 'retrieve-as-tool') {
					return inputs;
				}

				if (['insert', 'load', 'update'].includes(mode)) {
					inputs.push({ displayName: "", type: "${NodeConnectionType.Main}"})
				}

				if (['insert'].includes(mode)) {
					inputs.push({ displayName: "Document", type: "${NodeConnectionType.AiDocument}", required: true, maxConnections: 1})
				}
				return inputs
			})($parameter)
		}}`,
		outputs: `={{
			((parameters) => {
				const mode = parameters?.mode ?? 'retrieve';

				if (mode === 'retrieve-as-tool') {
					return [{ displayName: "Tool", type: "${NodeConnectionType.AiTool}"}]
				}

				if (mode === 'retrieve') {
					return [{ displayName: "Vector Store", type: "${NodeConnectionType.AiVectorStore}"}]
				}
				return [{ displayName: "", type: "${NodeConnectionType.Main}"}]
			})($parameter)
		}}`,
		properties: [
			{
				displayName: 'Operation Mode',
				name: 'mode',
				type: 'options',
				noDataExpression: true,
				default: 'retrieve',
				options: [
					{
						name: 'Get Many',
						value: 'load',
						description: 'Get many ranked documents from vector store for query',
						action: 'Get ranked documents from vector store',
					},
					{
						name: 'Insert Documents',
						value: 'insert',
						description: 'Insert documents into vector store',
						action: 'Add documents to vector store',
					},
					{
						name: 'Retrieve Documents (As Vector Store for Chain/Tool)',
						value: 'retrieve',
						description: 'Retrieve documents from vector store to be used as vector store with AI nodes',
						action: 'Retrieve documents for Chain/Tool as Vector Store',
						outputConnectionType: NodeConnectionType.AiVectorStore,
					},
					{
						name: 'Retrieve Documents (As Tool for AI Agent)',
						value: 'retrieve-as-tool',
						description: 'Retrieve documents from vector store to be used as tool with AI nodes',
						action: 'Retrieve documents for AI Agent as Tool',
						outputConnectionType: NodeConnectionType.AiTool,
					},
					{
						name: 'Update Documents',
						value: 'update',
						description: 'Update documents in vector store by ID',
						action: 'Update vector store documents',
					},
				]
			},
			{
				...getConnectionHintNoticeField([NodeConnectionType.AiRetriever]),
				displayOptions: {
					show: {
						mode: ['retrieve'],
					},
				},
			},
			{
				displayName: 'OpenSearch Index',
				name: 'indexName',
				type: 'resourceLocator',
				default: {mode: 'list', value: ''},
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'openSearchIndexSearch', // Method to fetch indexes
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						placeholder: 'e.g. my_index',
					},
				],
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				default: '',
				required: true,
				description: 'Search prompt to retrieve matching documents from the vector store using similarity-based ranking',
				displayOptions: {
					show: {
						mode: ['load'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'topK',
				type: 'number',
				default: 4,
				description: 'Number of top results to fetch from vector store',
				displayOptions: {
					show: {
						mode: ['load', 'retrieve-as-tool'],
					},
				},
			},
			{
				displayName: 'Include Metadata',
				name: 'includeDocumentMetadata',
				type: 'boolean',
				default: true,
				description: 'Whether or not to include document metadata',
				displayOptions: {
					show: {
						mode: ['load', 'retrieve-as-tool'],
					},
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				default: '',
				required: true,
				description: 'ID of an embedding entry',
				displayOptions: {
					show: {
						mode: ['update'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Index Field Names',
						name: 'fieldNames',
						type: 'fixedCollection',
						description: 'The names of the fields in OpenSearch index',
						default: {
							values: {
								vectorFieldName: 'vector',
								contentFieldName: 'text',
								metadataFieldName: 'metadata',
							},
						},
						typeOptions: {},
						placeholder: 'Set Field Names',
						options: [
							{
								name: 'values',
								displayName: 'Index Fields Name Settings',
								values: [
									{
										displayName: 'Vector Field Name',
										name: 'vectorFieldName',
										type: 'string',
										default: 'vector',
										required: true,
									},
									{
										displayName: 'Content Field Name',
										name: 'contentFieldName',
										type: 'string',
										default: 'text',
										required: true,
									},
									{
										displayName: 'Metadata Field Name',
										name: 'metadataFieldName',
										type: 'string',
										default: 'metadata',
										required: true,
									},
								],
							},
						],
					},
					metadataFilterField
				]
			}
		]
	};
	methods = {listSearch: {openSearchIndexSearch}};

	/**
	 * Method to execute the node in regular workflow mode
	 * Supports 'load', 'insert', and 'update' operation modes
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const mode = this.getNodeParameter('mode', 0) as NodeOperationMode;

		// Get the embeddings model connected to this node
		const embeddings = (await this.getInputConnectionData(
			NodeConnectionType.AiEmbedding,
			0,
		)) as Embeddings;

		// Handle each operation mode with dedicated modules
		if (mode === 'load') {
			const items = this.getInputData(0);
			const resultData = [];

			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
				const docs = await handleLoadOperation(this, nodeArgs, embeddings, itemIndex);
				resultData.push(...docs);
			}

			return [resultData];
		}

		if (mode === 'insert') {
			const resultData = await handleInsertOperation(this, nodeArgs, embeddings);
			return [resultData];
		}

		if (mode === 'update') {
			const resultData = await handleUpdateOperation(this, nodeArgs, embeddings);
			return [resultData];
		}

		throw new NodeOperationError(
			this.getNode(),
			'Only the "load", "update" and "insert" operation modes are supported with execute',
		);
	}

	/**
	 * Method to supply data to AI nodes
	 * Supports 'retrieve' and 'retrieve-as-tool' operation modes
	 */
	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		throw new NodeOperationError(
			this.getNode(),
			'Only the "retrieve" and "retrieve-as-tool" operation mode is supported to supply data',
		);
	}
}
