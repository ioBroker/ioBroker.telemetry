import React, {Component} from 'react';
import moment from 'moment';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Snackbar from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';

import {MdClose as IconClose} from 'react-icons/md';

import I18n from '@iobroker/adapter-react/i18n';
import Message from '@iobroker/adapter-react/Dialogs/Message';

import TreeTable from '@iobroker/adapter-react/Components/TreeTable';
import Utils from '@iobroker/adapter-react/Components/Utils';

const styles = theme => ({
});

const columns = [
    {
        title: I18n.t('Name'),
        field: 'name',
        subField: 'id',
        editable: false,
        subStyle: {
            opacity: 0.5
        }
    },
    /*{
        title: I18n.t('Name'),
        field: 'name',
        editable: false
    },*/
    {
        title: I18n.t('Type'),
        field: 'type',
        editable: false
    },
    {
        title: I18n.t('Debounce'),
        field: 'debounce'
    },
    {
        title: I18n.t('Ignore'),
        field: 'ignore',
        type: 'boolean'
    },
    {
        title: I18n.t('Last event'),
        field: 'lastEvent',
        editable: false
    },
    {
        title: I18n.t('Events in hour'),
        field: 'eventsInHour',
        editable: false
    },
];

class Objects extends Component {
    constructor(props) {
        super(props);
        this.propertyName = 'resources';

        this.state = {
            showHint: false,
            toast: '',
            alive: false,
            telemetryObjects: [],
        };

        this.props.socket.getState(`system.adapter.${this.props.adapterName}.${this.props.instance}.alive`)
            .then(state => {
                const newState = {alive: state && state.val};
                if (newState.alive) {
                    this.browse();
                } else {
                    this.setState(newState);
                }
            });
    }

    browse() {
        return this.props.socket.sendTo(this.props.adapterName + '.' + this.props.instance, 'browse', null)
            .then(result => {
                if (result.result) {
                    this.setState({telemetryObjects: result.result});
                } else {
                    this.setState({toast: I18n.t('Cannot get list:') + (result.error || 'see ioBroker log')});
                }
            });
    }

    componentDidMount() {
        this.props.socket.subscribeState(`system.adapter.${this.props.adapterName}.${this.props.instance}.alive`, this.onAliveChanged);
        this.props.socket.subscribeState(`${this.props.adapterName}.${this.props.instance}.data.update`, this.onUpdatesDetected);
    }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(`system.adapter.${this.props.adapterName}.${this.props.instance}.alive`, this.onAliveChanged);
        this.props.socket.unsubscribeState(`${this.props.adapterName}.${this.props.instance}.data.update`, this.onUpdatesDetected);
    }

    onAliveChanged = (id, state) => {
        this.setState({alive: state ? !!state.val : false});
    }

    onUpdatesDetected = () => {
        this.timer && clearTimeout(this.timer)
        this.timer = setTimeout(() => {
            this.timer = null;
            this.browse();
        }, 500);
    }

    renderToast() {
        if (!this.state.toast) return null;
        return (
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={true}
                autoHideDuration={6000}
                onClose={() => this.setState({toast: ''})}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                message={<span id="message-id">{this.state.toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        className={this.props.classes.close}
                        onClick={() => this.setState({toast: ''})}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />);
    }

    renderHint() {
        if (this.state.showHint) {
            return <Message text={I18n.t('Click now Get new connection certificates to request new temporary password')} onClose={() => this.setState({showHint: false})}/>;
        } else {
            return null;
        }
    }

    render() {
        if (!this.state.alive) {
            return <p>{I18n.t('Please start the instance first!')}</p>;
        }
        const lang = I18n.getLanguage();

        const data = Object.keys(this.state.telemetryObjects).map(id => {
            const object = this.state.telemetryObjects[id];
            return {
                id,
                name: Utils.getObjectNameFromObj({common: {name: object.name}}, lang),
                type: object.role,
                debounce: object.debounce || 0,
                ignore: object.ignore,
                lastEvent: object.lastEvent ? moment(object.lastEvent).format('YYYY-MM-DD HH:mm:ss') : null,
                eventsInHour: object.eventsInHour ? object.eventsInHour.length : null,
            }
        });
        return <TreeTable
            noAdd={true}
            data={data}
            columns={columns}
            glowOnChange={true}
            onUpdate={newData => {
                this.props.socket.getObject(newData.id)
                    .then(async obj => {
                        const namespace = this.props.adapterName + '.' + this.props.instance;
                        obj.common.custom = obj.common.custom || {};
                        obj.common.custom[namespace] = obj.common.custom[namespace] || {};
                        obj.common.custom[namespace].enabled = true;
                        obj.common.custom[namespace].ignore = newData.ignore;
                        obj.common.custom[namespace].debounce = newData.debounce;
                        if (!newData.ignore && !newData.debounce) {
                            obj.common.custom[namespace] = null;
                        }
                        await this.props.socket.setObject(obj._id, obj);
                    });
            }}
        />;
    }
}

Objects.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    theme: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    socket: PropTypes.object.isRequired
};

export default withStyles(styles)(Objects);
