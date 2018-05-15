package com.wavemaker.runtime.data.export;


import java.util.ArrayList;
import java.util.List;

public class ExportOptions {
    private List<FieldInfo> fields = new ArrayList<>();
    private ExportType exportType;
    private String query;

    public ExportOptions(ExportType exportType) {
        this.exportType = exportType;
    }

    public ExportOptions(ExportType exportType, String query) {
        this.exportType = exportType;
        this.query = query;
    }

    public ExportOptions(){}

    public List<FieldInfo> getFields() {
        return fields;
    }

    public void setFields(List<FieldInfo> fields) {
        this.fields = fields;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public ExportType getExportType() {
        return exportType;
    }

    public void setExportType(ExportType exportType) {
        this.exportType = exportType;
    }

}