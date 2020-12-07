import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';

import I18n from '@iobroker/adapter-react/i18n';
import Logo from './Logo';

const styles = theme => ({
    tab: {
        width: '100%',
        minHeight: '100%'
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20
    },
    columnSettings: {
        width: 'calc(100% - 370px)',
    },
    selectControl: {
        width: 200,
        paddingBottom: 20,
    }
});

class Options extends Component {
    constructor(props) {
        super(props);

        this.state = {
            historyList: [],
            statisticsList: [],
        };

        let sqlList;
        this.props.socket.getAdapterInstances('sql')
            .then(list => {
                sqlList = list;
                return this.props.socket.getAdapterInstances('influxdb');
            })
            .then(list => {
                sqlList = sqlList.concat(list);
                return this.props.socket.getAdapterInstances('statistics');
            })
            .then(list =>
                this.setState({
                    historyList: sqlList.map(obj => obj._id.replace('system.adapter.', '')),
                    statisticsList: list.map(obj => obj._id.replace('system.adapter.', ''))
                }));
    }

    validateFrom(from) {
        if (!from) {
            return false;
        }
        const m = from.match(/^(\d\d\d\d)-(\d\d?)$/);
        if (m) {
            const year  = parseInt(m[1], 10);
            const month = parseInt(m[2], 10);
            if (month >= 1 && month <= 12 && year > 2000 && year < 3000) {
                return true;
            }
        }
        return false;
    }

    render() {
        return (
            <form className={this.props.classes.tab}>
                <Logo
                    instance={this.props.instance}
                    common={this.props.common}
                    native={this.props.native}
                    onError={text => this.setState({errorText: text})}
                    onLoad={this.props.onLoad}
                />
                <div className={this.props.classes.column + ' ' + this.props.classes.columnSettings}>
                    <FormControl className={this.props.classes.selectControl}>
                        <InputLabel>{I18n.t('History instance')}</InputLabel>
                        <Select
                            value={this.props.native.historyInstance}
                            onChange={e => this.props.onChange('historyInstance', e.target.value)}
                        >
                            {this.state.historyList.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <br/>
                    <FormControl className={this.props.classes.selectControl}>
                        <InputLabel>{I18n.t('Statistics instance')}</InputLabel>
                        <Select
                            value={this.props.native.statisticsInstance || '_'}
                            onChange={e => this.props.onChange('statisticsInstance', e.target.value)}
                        >
                            <MenuItem key="none" value="_">{I18n.t('none')}</MenuItem>
                            {this.state.statisticsList.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <br/>
                    <TextField
                        value={this.props.native.startFrom}
                        error={!this.validateFrom(this.props.native.startFrom)}
                        onChange={e => this.props.onChange('startFrom', e.target.value)}
                        label={I18n.t('Start planning from')}
                        helperText={I18n.t('In Form YYYY-MM')}
                    />
                    <br/>
                    <TextField
                        value={this.props.native.colorStep}
                        type="number"
                        onChange={e => this.props.onChange('colorStep', e.target.value)}
                        label={I18n.t('Color step')}
                        helperText={I18n.t('Color step for stackbar and donut')}
                    />
                </div>
            </form>
        );
    }
}

Options.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(Options);
