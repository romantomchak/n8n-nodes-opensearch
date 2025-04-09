import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeTypeDescription,
	INodeType,
	INodeExecutionData,
	ISupplyDataFunctions,
	NodeOperationError,
	SupplyData
} from 'n8n-workflow';
import {NodeConnectionType} from 'n8n-workflow';
import {getConnectionHintNoticeField} from './utils/fields';

async function openSearchIndexSearch(this: ILoadOptionsFunctions) {
	const results: INodeListSearchItems[] = [];
	return {results};
}

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
			}
		]
	};
	methods = {listSearch: {openSearchIndexSearch}};

	/**
	 * Method to execute the node in regular workflow mode
	 * Supports 'load', 'insert', and 'update' operation modes
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
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
