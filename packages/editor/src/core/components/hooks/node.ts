import debounce from 'lodash.debounce';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HoverTarget } from '../../service/hover/computeHover';
import type { PositionEnum } from '../../const';
import { useSelector } from '../../reduxConnect';
import { findNodeInState } from '../../selector/editable';
import type { Cell, CellDrag, Node, Row } from '../../types/node';
import { isRow } from '../../types/node';
import deepEquals from '../../utils/deepEquals';
import { getAvailablePlugins } from '../../utils/getAvailablePlugins';
import { getCellData } from '../../utils/getCellData';
import { getCellInnerDivStylingProps } from '../../utils/getCellStylingProps';
import { getDropLevels } from '../../utils/getDropLevels';
import { useUpdateCellData } from './nodeActions';
import { useLang } from './options';
import { useRenderOption } from './renderOptions';

/**
 *
 */
type NodeSelector<T> = (node: Node, ancestors: Node[]) => T;

/**
 * Use this function to get derived properties of a node. It prevents unnessesary rerenders when only the nessesary properties are returned by the selector
 *
 * you can also select props from the ancestors of the node. Be aware that the last ancestor is the root document id
 *
 * @param nodeId an id of a node (cell or row)
 * @param selector receives the node object or null (if no node with this id exists) and returns T
 * @returns the selection T
 */
export const useNodeProps = <T>(
  nodeId: string,
  selector: NodeSelector<T>
): T => {
  const node = useSelector((state) => {
    const result = findNodeInState(state, nodeId);

    if (!result) {
      return selector(null, []);
    }
    return selector(result.node, result.ancestors);
  }, deepEquals);

  return node;
};

/**
 *
 * @param nodeId id of a node
 * @param selector receives the ancestors array and returns T
 * @returns T
 */
export const useNodeAncestorProps = <T>(
  nodeId: string,
  selector: (ancestors: Node[]) => T
) => {
  return useNodeProps(nodeId, (__, ancestors) => selector(ancestors));
};

type CellSelector<T> = (node: Cell, ancestors: Node[]) => T;

/**
 * This is the same as @see useNodeProps, but only for cells. selector will receive null if the given nodeId is not a cell
 * @param nodeId an id of a cell
 * @param selector receives the cell or null (if no cell with this id exists) object and returns T
 * @returns the selection T
 */
export const useCellProps = <T>(
  nodeId: string,
  selector: CellSelector<T>
): T => {
  if (!nodeId) {
    return null;
  }
  return useNodeProps(nodeId, (node, ancestors) =>
    node && !isRow(node) ? selector(node, ancestors) : selector(null, ancestors)
  );
};

/**
 * better use useCellProps, unless you really need the full cell object
 * @param nodeId an id of a cell
 * @returns full Cell object
 */
export const useCell = (nodeId: string) => {
  return useNodeProps(nodeId, (node, ancestors) =>
    !isRow(node) ? node : null
  );
};

type RowSelector<T> = (node: Row, ancestors: Node[]) => T;
/**
 * This is the same as @see useNodeProps, but only for rows.
 * @param nodeId an id of a row
 * @param selector receives the row or null (if no row with this id exists) object and returns T
 * @returns the selection T
 */
export const useRowProps = <T>(nodeId: string, selector: RowSelector<T>): T => {
  return useNodeProps(nodeId, (node, ancestors) =>
    isRow(node) ? selector(node, ancestors) : null
  );
};

/**
 *
 * @param nodeId id of a node
 * @returns the relative hover position over the given node, or null if this node is not hovered over
 */
export const useNodeHoverPosition = (nodeId: string): PositionEnum => {
  return useSelector((state) =>
    state.reactPage.hover?.nodeId === nodeId
      ? state.reactPage.hover?.position
      : null
  );
};

/**
 *
 * @param nodeId id of a node
 * @returns an array of ids that are ancestors of the given node
 */
export const useNodeAncestorIds = (nodeId: string) => {
  return useNodeAncestorProps(nodeId, (ancestors) =>
    ancestors.map((a) => a.id)
  );
};

/**
 *
 * @param nodeId the id of a row or cell
 * @returns the nearest ancestor cell of the cell or row that has a plugin
 */
export const useParentCellId = (nodeId: string) => {
  return useNodeProps(nodeId, (node, ancestors) =>
    node && ancestors
      ? ancestors.find((node) => !isRow(node) && node.plugin)?.id
      : null
  );
};

/**
 * returns a cell as a HoverTarget that is suiteable to be passed to the drop-logic
 *
 * @param nodeId a nodeId
 * @returns a HoverTarget
 */
export const useNodeAsHoverTarget = (nodeId: string): HoverTarget => {
  return useNodeProps(nodeId, (node, ancestors) =>
    node
      ? {
          id: node.id,
          // the last element is the root element, we can't currenly use that as hover target
          ancestorIds: ancestors.slice(0, -1).map((a) => a.id),
          hasInlineNeighbour: !isRow(node) ? node.hasInlineNeighbour : null,
          inline: !isRow(node) ? node.inline : null,
          levels: getDropLevels(node, ancestors),
          pluginId: !isRow(node) ? node.plugin?.id : null,
        }
      : null
  );
};

/**
 *
 * @deprecated currently unused
 */
export const useCellBounds = (nodeId: string) => {
  return useNodeProps(nodeId, (node, ancestors) => {
    const parent = isRow(ancestors[0]) ? ancestors[0] : null;
    const myIndex = parent?.cells.findIndex((c) => c.id === node.id) ?? -1;
    const cell = !isRow(node) ? node : null;
    if (!cell || myIndex < 0) {
      return null;
    }
    if (cell.inline) {
      return {
        left: 0,
        right: 0,
      };
    }
    return {
      left: myIndex > 0 ? parent.cells[myIndex - 1].size + cell.size - 1 : 0,
      right:
        myIndex === parent.cells.length - 1
          ? 0
          : cell.size - 1 + parent.cells[myIndex + 1].size,
    };
  });
};

/**
 *
 * @param nodeId a node id
 * @returns an array of nodeIds that are direct children of the given node
 */
export const useNodeChildrenIds = (nodeId: string) => {
  return useNodeProps(nodeId, (node) =>
    isRow(node)
      ? node.cells?.map((c) => c.id) ?? []
      : node.rows?.map((r) => r.id) ?? []
  );
};

/**
 *
 * @param nodeId a node id
 * @returns true if node has children
 */
export const useNodeHasChildren = (nodeId: string) => {
  return useNodeProps(nodeId, (node) =>
    isRow(node)
      ? node.cells?.length > 0 ?? false
      : node.rows?.length > 0 ?? false
  );
};
/**
 *
 * @param nodeId an id of a cell
 * @returns true if this cell has a configured plugin. It does not check if this plugin exists (in @see Options)
 */
export const useCellHasPlugin = (nodeId: string) => {
  return useCellProps(nodeId, (c) => Boolean(c.plugin));
};

/**
 * @param parentNodeId the parent node id, or null if its the root
 * @returns all configured CellPlugin that are allowed in the given parentCellId
 */
export const useAllCellPluginsForNode = (parentNodeId?: string) => {
  const currentLang = useLang();

  const ancestors = useNodeProps(parentNodeId, (node, ancestors) => {
    return [node, ...ancestors].reverse().map((a) => {
      return {
        pluginId: !a || isRow(a) ? null : a.plugin?.id,
        data: !a || isRow(a) ? null : getCellData(a, currentLang),
      };
    });
  });
  // pluginIdsOfAncestors is an array of ids, the last one is the
  const rootCellPlugins = useRenderOption('cellPlugins');
  return useMemo(() => {
    return getAvailablePlugins(rootCellPlugins, ancestors);
  }, [rootCellPlugins, ancestors]);
};

export const useCellIsAllowedHere = (nodeId?: string) => {
  const availablePlugins = useAllCellPluginsForNode(nodeId);
  return useCallback(
    (item: CellDrag) => {
      if (!item?.cell) {
        return false;
      }
      const itemPluginId =
        typeof item.cell?.plugin === 'string'
          ? item.cell.plugin
          : item.cell?.plugin.id;
      const allowed =
        !item.cell?.plugin ||
        availablePlugins.some((p) => p.id === itemPluginId);

      return allowed;
    },
    [availablePlugins]
  );
};

/**
 * Use this function to get the plugin of a cell.
 * @param nodeId an id of a cell
 * @returns the plugin of the given cell
 *
 */
export const usePluginOfCell = (nodeId: string) => {
  const { pluginId, parentNodeId } = useCellProps(nodeId, (c, ancestors) => ({
    pluginId: c?.plugin?.id,
    parentNodeId: ancestors?.[0]?.id,
  }));
  const plugins = useAllCellPluginsForNode(parentNodeId);
  return plugins.find((p) => p.id === pluginId);
};

/**
 *
 * @param nodeId a cell id
 * @returns the raw localized data of the cell
 */
export const useCellDataI18nRaw = (nodeId: string) => {
  return useCellProps(nodeId, (c) => c?.dataI18n);
};

/**
 *
 * @param nodeId a cell id
 * @param lang a language key
 * @returns the data object in the given language of the given cell
 */
export const useCellData = (nodeId: string, lang?: string) => {
  const currentLang = useLang();
  const theLang = lang ?? currentLang;

  return useCellProps(nodeId, (c) => getCellData(c, theLang) ?? {});
};

/**
 *returns style and classname of a cell's inner div
 * @param nodeId a cell id
 * @param lang a language key (optionally)
 * @returns the data object in the given language of the given cell
 */
export const useCellInnerDivStylingProps = (
  nodeId: string,
  lang?: string
): {
  className: string;
  style: CSSProperties;
} => {
  const plugin = usePluginOfCell(nodeId);

  const currentLang = useLang();
  const theLang = lang ?? currentLang;

  return useCellProps(nodeId, (c) => {
    const data = getCellData(c, theLang);
    return getCellInnerDivStylingProps(c, plugin, data);
  });
};

/**
 *
 * @returns [data, onChangeData] pair, with setData debouncing the propagation
 * also data is always partially updated
 * @param nodeId the id of a cell
 */
export const useDebouncedCellData = (nodeId: string) => {
  const cellData = useCellData(nodeId);
  const [, setData] = useState(cellData);
  const dataRef = useRef(cellData);
  const cellDataRef = useRef(cellData);

  const updateCellData = useUpdateCellData(nodeId);
  const updateCellDataDebounced = useCallback(
    debounce((options) => {
      cellDataRef.current = dataRef.current;
      updateCellData(dataRef.current, options);
    }, 200),
    [updateCellData]
  );

  const changed = useMemo(() => !deepEquals(cellData, cellDataRef.current), [
    cellData,
  ]);

  useEffect(() => {
    // changed from "outside" overwrite whatever is pending
    if (changed) {
      cellDataRef.current = cellData;
      dataRef.current = cellData;
      setData(cellData);
    }
  }, [changed, cellData]);

  const onChange = useCallback(
    (partialData, options) => {
      dataRef.current = {
        ...dataRef.current,
        ...partialData,
      };
      setData(dataRef.current);

      updateCellDataDebounced(options);
    },
    [updateCellDataDebounced, setData]
  );
  return [dataRef.current, onChange] as const;
};
